"""Generate the pre-computed library (PRD §11.5, §6.5).

Runs a set of scenarios through the engine, uploads each region's
year-by-year result as a private Vercel Blob, and upserts a catalog row
into Neon Postgres (library_cases, see setup_library_schema.py).

Deliberately small relative to the full PRD library (10 CO2 prices x 13
regions x several variant groups -- PRD §5.5: a full Case is ~1h40m).
GROUPS is the full cross product of every (group, variant) template x
every region x all 4 constant CO2 levels (574 cases total), so the
frontend's dropdown pickers (region -> group -> variant -> CO2) never
hit a dead combination. Extend REGIONS or VARIANT_TEMPLATES to grow it
further; it's idempotent (upserts by case_id, skips existing case_ids),
~45-60s per case.

Uploads via Vercel Blob's REST API (optimize_engine.blob), shared with
run_worker.py -- there's no first-party Python SDK for Vercel Blob.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from dataclasses import dataclass, field
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from optimize_engine import ScenarioConfig, SourceTweaks, TweakPair, run_scenario
from optimize_engine.blob import upload_json_blob
from optimize_engine.schemas import SOURCES

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WEB_DIR = REPO_ROOT / 'web'
ENGINE_DIR = REPO_ROOT / 'engine'

# Projected-year span. The engine writes a base-year row (year 0 = the last
# complete year of EIA data) plus YEARS projected rows, so the library's last
# simulated year is first_year + YEARS. With data through 2025 that lands on
# 2050 -- a clean 25-year horizon.
YEARS = 25

# (co2_initial, co2_yearly) under Constant_CO2 -- matches the real sample
# cases shipped in vendor/optimize-original/Samples/CO2-0 thru 500/.
CONSTANT_CO2 = [(0, 0, 'Constant_CO2'), (100, 0, 'Constant_CO2'),
                (200, 0, 'Constant_CO2'), (500, 0, 'Constant_CO2')]
# A cheaper spread for knob-isolation cases -- just enough to show the
# knob's effect at low and high carbon prices without re-running all 4.
CONSTANT_CO2_ENDS = [(0, 0, 'Constant_CO2'), (500, 0, 'Constant_CO2')]
# Increasing_CO2: co2_initial is the $/yr step, co2_yearly is the cap it
# climbs to (see fig_tweakxs) -- distinct semantics from Constant_CO2,
# where co2_yearly=0 means "cap already reached, stays flat".
INCREASING_CO2 = [(15, 300, 'Increasing_CO2'), (30, 500, 'Increasing_CO2')]


@dataclass
class CaseGroup:
    group: str
    variant: str
    region: str
    co2_scenarios: list[tuple[float, float, str]]
    source_overrides: dict = field(default_factory=dict)
    interest: tuple[float, float] = (0.12, 1)
    demand: tuple[float, float] = (1.02, 1)


# All 13 EIA regions x every variant x all 4 constant CO2 levels, so the
# frontend's dropdown pickers never hit a dead combination. Increasing_CO2
# stays a CAL/Default-only bonus rather than multiplying this further.
# 11 variants x 13 regions x 4 CO2 + 2 Increasing_CO2 = 574 cases. A full
# regen from empty is several hours (~45-60s each), but it's idempotent and
# resumable -- unchanged cases are skipped, so adding regions only computes
# the new ones.
REGIONS = ['CAL', 'CAR', 'CENT', 'FLA', 'MIDA', 'MIDW', 'NE', 'NW', 'NY',
           'SE', 'SW', 'TEN', 'TEX']

# (group, variant, source_overrides, interest, demand)
VARIANT_TEMPLATES: list[tuple[str, str, dict, tuple[float, float], tuple[float, float]]] = [
    ('Default', 'Default', {}, (0.12, 1), (1.02, 1)),
    ('Cheap_Nuclear', 'Half_Cap', {'Nuclear': {'capital': (0.5, 1)}}, (0.12, 1), (1.02, 1)),
    ('Cheap_Nuclear', '3_Qtr_Cap', {'Nuclear': {'capital': (0.75, 1)}}, (0.12, 1), (1.02, 1)),
    ('Cheap_Renewable', 'Half_Cap',
     {'Solar': {'capital': (0.5, 1)}, 'Wind': {'capital': (0.5, 1)}}, (0.12, 1), (1.02, 1)),
    ('Cheap_Renewable', '3_Qtr_Cap',
     {'Solar': {'capital': (0.75, 1)}, 'Wind': {'capital': (0.75, 1)}}, (0.12, 1), (1.02, 1)),
    ('Fast_Build', 'Double_All',
     {s: {'max_pct': (2, 1)} for s in ['Solar', 'Wind', 'Nuclear', 'Gas', 'Coal']}, (0.12, 1), (1.02, 1)),
    ('Fast_Build', 'Quad_All',
     {s: {'max_pct': (4, 1)} for s in ['Solar', 'Wind', 'Nuclear', 'Gas', 'Coal']}, (0.12, 1), (1.02, 1)),
    ('Interest_Rate', '3pct_Interest', {}, (0.03, 1), (1.02, 1)),
    ('Interest_Rate', '6pct_Interest', {}, (0.06, 1), (1.02, 1)),
    ('Demand', '1pct_Growth', {}, (0.12, 1), (1.01, 1)),
    ('Demand', '3pct_Growth', {}, (0.12, 1), (1.03, 1)),
]

GROUPS = [
    CaseGroup(
        group, variant, region,
        CONSTANT_CO2 + (INCREASING_CO2 if (group, variant, region) == ('Default', 'Default', 'CAL') else []),
        source_overrides=overrides, interest=interest, demand=demand,
    )
    for (group, variant, overrides, interest, demand) in VARIANT_TEMPLATES
    for region in REGIONS
]


def _env() -> dict:
    # Prefer real env vars (GitHub Actions / Render set DATABASE_URL and
    # BLOB_READ_WRITE_TOKEN as secrets); fall back to web/.env.local (pulled
    # via `vercel env pull`) so it also runs from a laptop. Mirrors
    # run_worker.py's _env().
    env = {
        'DATABASE_URL': os.environ.get('DATABASE_URL'),
        'BLOB_READ_WRITE_TOKEN': os.environ.get('BLOB_READ_WRITE_TOKEN'),
    }
    if not env['DATABASE_URL'] or not env['BLOB_READ_WRITE_TOKEN']:
        local_env = dotenv_values(WEB_DIR / '.env.local')
        env['DATABASE_URL'] = env['DATABASE_URL'] or local_env.get('DATABASE_URL')
        env['BLOB_READ_WRITE_TOKEN'] = (
            env['BLOB_READ_WRITE_TOKEN'] or local_env.get('BLOB_READ_WRITE_TOKEN'))
    if not env['DATABASE_URL'] or not env['BLOB_READ_WRITE_TOKEN']:
        raise RuntimeError(
            'DATABASE_URL / BLOB_READ_WRITE_TOKEN not set in env or web/.env.local')
    return env


def _specs_version() -> str:
    specs_bytes = (ENGINE_DIR / 'data' / 'Specs.csv').read_bytes()
    return hashlib.sha256(specs_bytes).hexdigest()[:12]


def _eia_version() -> str:
    meta_path = ENGINE_DIR / 'data' / 'eia_parquet' / 'meta.json'
    if meta_path.exists():
        return json.loads(meta_path.read_text())['version']
    return 'unknown'


def _clean_records(records: list[dict]) -> list[dict]:
    """Drop the bare-source-name marker columns (e.g. "Solar": NaN) that
    init_output_matrix carries over from the original Excel transposed
    layout's merged-header columns -- they're not real data (real values
    live under "Solar_MW", "Solar_MWh", etc.) and NaN isn't valid JSON,
    so JSON.parse on the frontend would fail on them."""
    return [{k: v for k, v in record.items() if k not in SOURCES} for record in records]


def _upload_blob(case_id: str, records: list, rw_token: str) -> str:
    records = _clean_records(records)
    return upload_json_blob(f'library/{case_id}.json', records, rw_token)


UPSERT_SQL = """
INSERT INTO library_cases (
    case_id, group_name, variant, co2_regime, co2_initial, co2_yearly,
    region, years, config, result_blob_url, engine_version, specs_version, eia_version
) VALUES (
    %(case_id)s, %(group_name)s, %(variant)s, %(co2_regime)s, %(co2_initial)s, %(co2_yearly)s,
    %(region)s, %(years)s, %(config)s, %(result_blob_url)s, %(engine_version)s, %(specs_version)s, %(eia_version)s
)
ON CONFLICT (case_id) DO UPDATE SET
    years = EXCLUDED.years,
    config = EXCLUDED.config,
    result_blob_url = EXCLUDED.result_blob_url,
    engine_version = EXCLUDED.engine_version,
    specs_version = EXCLUDED.specs_version,
    eia_version = EXCLUDED.eia_version,
    created_at = now();
"""


def _build_sources(overrides: dict) -> dict:
    sources = {}
    for name in SOURCES:
        tweaks = SourceTweaks()
        for f, (initial, yearly) in overrides.get(name, {}).items():
            setattr(tweaks, f, TweakPair(initial=initial, yearly=yearly))
        sources[name] = tweaks
    return sources


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Generate the pre-computed scenario library.')
    parser.add_argument(
        '--regions',
        help='Comma-separated region subset to generate (default: all regions).')
    parser.add_argument(
        '--max-cases', type=int, default=None,
        help='Stop after computing this many new cases this run (skipped cases '
             'do not count). The run is idempotent and resumable, so re-invoke '
             'to continue -- use this to keep a single GitHub Actions run under '
             'the hosted runner 6-hour job cap.')
    args = parser.parse_args()

    wanted_regions = (
        {r.strip() for r in args.regions.split(',') if r.strip()}
        if args.regions else None)

    env = _env()
    engine_version = importlib.metadata.version('optimize-engine')
    specs_version = _specs_version()
    eia_version = _eia_version()

    groups = [g for g in GROUPS if wanted_regions is None or g.region in wanted_regions]

    total = 0
    skipped = 0
    reached_limit = False

    # A case_id existing isn't enough -- if the EIA data (or specs) backing
    # it has since been refreshed, or the projected-year span (YEARS) has
    # changed, its stored result is stale (wrong first_year/baseline or wrong
    # horizon) and must be regenerated, not skipped. Only skip cases whose
    # recorded versions AND horizon still match what we'd generate right now.
    with psycopg.connect(env['DATABASE_URL']) as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT case_id FROM library_cases '
                'WHERE eia_version = %s AND specs_version = %s AND years = %s',
                (eia_version, specs_version, YEARS))
            existing_case_ids = {row[0] for row in cur.fetchall()}

    for g in groups:
        if reached_limit:
            break
        group_slug = g.group.lower()
        variant_slug = g.variant.lower()
        for co2_initial, co2_yearly, co2_regime in g.co2_scenarios:
            regime_slug = co2_regime.lower()
            case_id = (f'{group_slug}/{variant_slug}/{regime_slug}/'
                       f'co2_{co2_initial}_{co2_yearly}/{g.region}')

            if case_id in existing_case_ids:
                print(f'--- {case_id} (skip, already exists) ---')
                skipped += 1
                continue

            if args.max_cases is not None and total >= args.max_cases:
                print(f'Reached --max-cases={args.max_cases}; stopping early '
                      f'(resumable -- re-run to continue).')
                reached_limit = True
                break

            print(f'--- {case_id} ---')

            config = ScenarioConfig(
                region=g.region,
                sub_dir=case_id.replace('/', '-'),
                years=YEARS,
                co2_price=TweakPair(initial=co2_initial, yearly=co2_yearly),
                interest=TweakPair(initial=g.interest[0], yearly=g.interest[1]),
                demand=TweakPair(initial=g.demand[0], yearly=g.demand[1]),
                sources=_build_sources(g.source_overrides),
            )

            result = run_scenario(
                config,
                progress_cb=lambda r, year, years: print(f'  {r} year {year}/{years}'),
            )
            region_result = result.regions[0]

            blob_url = _upload_blob(case_id, region_result.years, env['BLOB_READ_WRITE_TOKEN'])
            print(f'  uploaded -> {blob_url}')

            # A fresh connection per case, opened only after the (slow, DB-free)
            # scenario computation -- a single connection held open across the
            # whole ~100min run gets dropped by Neon partway through
            # ("server closed the connection unexpectedly").
            with psycopg.connect(env['DATABASE_URL']) as conn:
                with conn.cursor() as cur:
                    cur.execute(UPSERT_SQL, {
                        'case_id': case_id,
                        'group_name': g.group,
                        'variant': g.variant,
                        'co2_regime': co2_regime,
                        'co2_initial': co2_initial,
                        'co2_yearly': co2_yearly,
                        'region': g.region,
                        'years': YEARS,
                        'config': json.dumps(config.model_dump()),
                        'result_blob_url': blob_url,
                        'engine_version': engine_version,
                        'specs_version': specs_version,
                        'eia_version': eia_version,
                    })
                conn.commit()
            print('  catalog row upserted')
            total += 1

    tail = ' -- more remain, re-run to continue' if reached_limit else ''
    print(f'Done: {total} generated, {skipped} skipped (already existed){tail}')


if __name__ == '__main__':
    main()
