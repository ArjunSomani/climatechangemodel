"""Generate the pre-computed library (PRD §11.5, §6.5).

Runs a set of scenarios through the engine, uploads each region's
year-by-year result as a private Vercel Blob, and upserts a catalog row
into Neon Postgres (library_cases, see setup_library_schema.py).

Deliberately small relative to the full PRD library (10 CO2 prices x 13
regions x several variant groups -- PRD §5.5: a full Case is ~1h40m).
CASE_DEFS crossed with CO2_LEVELS below covers 3 regions on the Default
variant plus a Cheap_Nuclear variant for CAL, enough for the Compare
view to have something real to show. Extend either list to grow it
further the same way; it's idempotent (upserts by case_id).

Requires `vercel` CLI to be linked in web/ (already the case) -- shells
out to `vercel blob put` rather than using Blob's REST API directly,
since there's no first-party Python SDK for Vercel Blob.
"""
import hashlib
import importlib.metadata
import json
import subprocess
import tempfile
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from optimize_engine import ScenarioConfig, SourceTweaks, TweakPair, run_scenario
from optimize_engine.schemas import SOURCES

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WEB_DIR = REPO_ROOT / 'web'
ENGINE_DIR = REPO_ROOT / 'engine'

CO2_REGIME = 'Constant_CO2'
YEARS = 27

# (co2_initial, co2_yearly) -- matches the real sample cases shipped in
# vendor/optimize-original/Samples/CO2-0 thru 500/Results_CO2-*-0_US.xlsm
CO2_LEVELS = [(0, 0), (100, 0), (200, 0), (500, 0)]

# Each entry: (group, variant, region, source_overrides). source_overrides
# maps SOURCE name -> field -> (initial, yearly), applied on top of the
# all-1s default from ScenarioConfig's SourceTweaks.
CASE_DEFS = [
    ('Default', 'Default', 'CAL', {}),
    ('Default', 'Default', 'TEX', {}),
    ('Default', 'Default', 'NY', {}),
    # Matches the source repo's "Half_Cap" naming (Library/Cheap_Nuclear/Half_Cap/).
    ('Cheap_Nuclear', 'Half_Cap', 'CAL', {'Nuclear': {'capital': (0.5, 1)}}),
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
        for field, (initial, yearly) in overrides.get(name, {}).items():
            setattr(tweaks, field, TweakPair(initial=initial, yearly=yearly))
        sources[name] = tweaks
    return sources


def main() -> None:
    env = _env()
    engine_version = importlib.metadata.version('optimize-engine')
    specs_version = _specs_version()
    eia_version = _eia_version()

    total = 0
    with psycopg.connect(env['DATABASE_URL']) as conn:
        for group, variant, region, overrides in CASE_DEFS:
            group_slug = group.lower()
            variant_slug = variant.lower()
            for co2_initial, co2_yearly in CO2_LEVELS:
                case_id = f'{group_slug}/{variant_slug}/constant_co2/co2_{co2_initial}_{co2_yearly}/{region}'
                print(f'--- {case_id} ---')

                config = ScenarioConfig(
                    region=region,
                    sub_dir=case_id.replace('/', '-'),
                    years=YEARS,
                    co2_price=TweakPair(initial=co2_initial, yearly=co2_yearly),
                    interest=TweakPair(initial=0.12, yearly=1),
                    demand=TweakPair(initial=1.02, yearly=1),
                    sources=_build_sources(overrides),
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
                        'group_name': group,
                        'variant': variant,
                        'co2_regime': CO2_REGIME,
                        'co2_initial': co2_initial,
                        'co2_yearly': co2_yearly,
                        'region': region,
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

    print(f'Done: {total} cases')


if __name__ == '__main__':
    main()
