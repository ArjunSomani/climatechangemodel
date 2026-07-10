"""Generate a small starter library of pre-computed cases (PRD §11.5, §6.5).

Runs a handful of "Default" group / Constant_CO2 scenarios through the
engine, uploads each region's year-by-year result as a private Vercel
Blob, and upserts a catalog row into Neon Postgres (library_cases,
see setup_library_schema.py).

This is deliberately small (one region, four CO2 price points, matching
the actual sample cases in vendor/optimize-original/Samples/CO2-0 thru
500/) to bootstrap Phase 1's schema/pages against real data without
paying for a full 13-region x 10-CO2-price library run (PRD §5.5: a
full Case is ~1h40m). Extend CASES below (or add a region loop) to grow
the library the same way once the schema/pages are proven out.

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

from optimize_engine import ScenarioConfig, TweakPair, run_scenario
from optimize_engine.schemas import SOURCES

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WEB_DIR = REPO_ROOT / 'web'
ENGINE_DIR = REPO_ROOT / 'engine'

GROUP = 'Default'
VARIANT = 'Default'
CO2_REGIME = 'Constant_CO2'
REGION = 'CAL'
YEARS = 27

# (co2_initial, co2_yearly) -- matches the real sample cases shipped in
# vendor/optimize-original/Samples/CO2-0 thru 500/Results_CO2-*-0_US.xlsm
CASES = [(0, 0), (100, 0), (200, 0), (500, 0)]


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


def main() -> None:
    env = _env()
    engine_version = importlib.metadata.version('optimize-engine')
    specs_version = _specs_version()
    eia_version = _eia_version()

    with psycopg.connect(env['DATABASE_URL']) as conn:
        for co2_initial, co2_yearly in CASES:
            case_id = f'default/default/constant_co2/co2_{co2_initial}_{co2_yearly}/{REGION}'
            print(f'--- {case_id} ---')

            config = ScenarioConfig(
                region=REGION,
                sub_dir=case_id.replace('/', '-'),
                years=YEARS,
                co2_price=TweakPair(initial=co2_initial, yearly=co2_yearly),
                interest=TweakPair(initial=0.12, yearly=1),
                demand=TweakPair(initial=1.02, yearly=1),
            )

            result = run_scenario(
                config,
                progress_cb=lambda region, year, years: print(f'  {region} year {year}/{years}'),
            )
            region_result = result.regions[0]

            blob_url = _upload_blob(case_id, region_result.years, env['BLOB_READ_WRITE_TOKEN'])
            print(f'  uploaded -> {blob_url}')

            with conn.cursor() as cur:
                cur.execute(UPSERT_SQL, {
                    'case_id': case_id,
                    'group_name': GROUP,
                    'variant': VARIANT,
                    'co2_regime': CO2_REGIME,
                    'co2_initial': co2_initial,
                    'co2_yearly': co2_yearly,
                    'region': REGION,
                    'years': YEARS,
                    'config': json.dumps(config.model_dump()),
                    'result_blob_url': blob_url,
                    'engine_version': engine_version,
                    'specs_version': specs_version,
                    'eia_version': eia_version,
                })
            conn.commit()
            print(f'  catalog row upserted')

    print(f'Done: {len(CASES)} cases')


if __name__ == '__main__':
    main()
