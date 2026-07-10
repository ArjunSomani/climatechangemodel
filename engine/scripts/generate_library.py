"""Generate the pre-computed library (PRD §11.5, §6.5).

Runs a set of scenarios through the engine, uploads each region's
year-by-year result as a private Vercel Blob, and upserts a catalog row
into Neon Postgres (library_cases, see setup_library_schema.py).

Deliberately small relative to the full PRD library (10 CO2 prices x 13
regions x several variant groups -- PRD §5.5: a full Case is ~1h40m).
GROUPS is the full cross product of every (group, variant) template x
every region x all 4 constant CO2 levels (134 cases total), so the
frontend's dropdown pickers (region -> group -> variant -> CO2) never
hit a dead combination. Extend REGIONS or VARIANT_TEMPLATES to grow it
further; it's idempotent (upserts by case_id, skips existing case_ids),
~45-60s per case.

Requires `vercel` CLI to be linked in web/ (already the case) -- shells
out to `vercel blob put` rather than using Blob's REST API directly,
since there's no first-party Python SDK for Vercel Blob.
"""
import hashlib
import importlib.metadata
import json
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from optimize_engine import ScenarioConfig, SourceTweaks, TweakPair, run_scenario
from optimize_engine.schemas import SOURCES

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WEB_DIR = REPO_ROOT / 'web'
ENGINE_DIR = REPO_ROOT / 'engine'

YEARS = 27

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


# Every region x every variant x all 4 constant CO2 levels, so the
# frontend's dropdown pickers never hit a dead combination. Increasing_CO2
# stays a CAL/Default-only bonus rather than doubling this again --
# ~98 new cases at ~45-60s each already runs to over an hour.
REGIONS = ['CAL', 'TEX', 'NY']

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
    env = dotenv_values(WEB_DIR / '.env.local')
    if not env.get('DATABASE_URL') or not env.get('BLOB_READ_WRITE_TOKEN'):
        raise RuntimeError('web/.env.local is missing DATABASE_URL or BLOB_READ_WRITE_TOKEN')
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
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(records, f)
        tmp_path = f.name

    try:
        result = subprocess.run(
            [
                'vercel', 'blob', 'put', tmp_path,
                '--access', 'private',
                '--pathname', f'library/{case_id}.json',
                '--allow-overwrite', 'true',
                '--rw-token', rw_token,
            ],
            cwd=WEB_DIR,
            capture_output=True,
            text=True,
            timeout=60,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if result.returncode != 0:
        raise RuntimeError(f'vercel blob put failed for {case_id}:\n{result.stdout}\n{result.stderr}')

    # The CLI writes its status lines to stderr (not stdout) outside a TTY.
    for line in (result.stdout + result.stderr).splitlines():
        if line.strip().startswith('> Success!'):
            return line.split('Success!', 1)[1].strip()

    raise RuntimeError(
        f'Could not parse blob URL from output for {case_id}:\nSTDOUT:{result.stdout}\nSTDERR:{result.stderr}')


UPSERT_SQL = """
INSERT INTO library_cases (
    case_id, group_name, variant, co2_regime, co2_initial, co2_yearly,
    region, years, config, result_blob_url, engine_version, specs_version, eia_version
) VALUES (
    %(case_id)s, %(group_name)s, %(variant)s, %(co2_regime)s, %(co2_initial)s, %(co2_yearly)s,
    %(region)s, %(years)s, %(config)s, %(result_blob_url)s, %(engine_version)s, %(specs_version)s, %(eia_version)s
)
ON CONFLICT (case_id) DO UPDATE SET
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
    env = _env()
    engine_version = importlib.metadata.version('optimize-engine')
    specs_version = _specs_version()
    eia_version = _eia_version()

    total = 0
    skipped = 0
    with psycopg.connect(env['DATABASE_URL']) as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT case_id FROM library_cases')
            existing_case_ids = {row[0] for row in cur.fetchall()}

        for g in GROUPS:
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

    print(f'Done: {total} generated, {skipped} skipped (already existed)')


if __name__ == '__main__':
    main()
