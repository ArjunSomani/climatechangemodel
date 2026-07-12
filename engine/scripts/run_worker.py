"""Background worker for on-demand custom runs (Phase 3).

Long-running poll loop: claims one `queued` row from Neon's `runs` table
(setup_runs_schema.py), executes it through the same run_scenario()
entrypoint generate_library.py uses, uploads the result to Vercel Blob,
and writes the outcome back. Deploy as a Render background worker (not
a web service) -- it never opens an HTTP port.

Uses a fresh Postgres connection per iteration rather than holding one
open across the whole poll loop, since Neon drops idle connections held
open too long (see generate_library.py's note on the same issue).
"""
import importlib.metadata
import json
import time
import traceback

import psycopg
from dotenv import dotenv_values

from optimize_engine import ScenarioConfig, run_scenario
from optimize_engine.blob import upload_json_blob
from optimize_engine.schemas import SOURCES

POLL_INTERVAL_SECONDS = 3

CLAIM_SQL = """
UPDATE runs
SET status = 'running', updated_at = now()
WHERE id = (
    SELECT id FROM runs
    WHERE status = 'queued'
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING id, config;
"""

DONE_SQL = """
UPDATE runs
SET status = 'done', result_blob_url = %(result_blob_url)s, engine_version = %(engine_version)s, updated_at = now()
WHERE id = %(id)s;
"""

ERROR_SQL = """
UPDATE runs SET status = 'error', error_message = %(error_message)s, updated_at = now()
WHERE id = %(id)s;
"""


def _env() -> dict:
    import os
    from pathlib import Path

    # On Render, DATABASE_URL/BLOB_READ_WRITE_TOKEN are set as real env vars
    # in the service's dashboard. Locally, fall back to web/.env.local
    # (pulled via `vercel env pull`) so the worker also runs from a laptop.
    env = {
        'DATABASE_URL': os.environ.get('DATABASE_URL'),
        'BLOB_READ_WRITE_TOKEN': os.environ.get('BLOB_READ_WRITE_TOKEN'),
    }
    if not env['DATABASE_URL'] or not env['BLOB_READ_WRITE_TOKEN']:
        web_env_file = Path(__file__).resolve().parent.parent.parent / 'web' / '.env.local'
        local_env = dotenv_values(web_env_file)
        env['DATABASE_URL'] = env['DATABASE_URL'] or local_env.get('DATABASE_URL')
        env['BLOB_READ_WRITE_TOKEN'] = env['BLOB_READ_WRITE_TOKEN'] or local_env.get('BLOB_READ_WRITE_TOKEN')

    if not env['DATABASE_URL'] or not env['BLOB_READ_WRITE_TOKEN']:
        raise RuntimeError('DATABASE_URL / BLOB_READ_WRITE_TOKEN not set in env or web/.env.local')
    return env


def _clean_records(records: list[dict]) -> list[dict]:
    """Drop the bare-source-name marker columns; see generate_library.py."""
    return [{k: v for k, v in record.items() if k not in SOURCES} for record in records]


def _claim_job(database_url: str) -> tuple[str, dict] | None:
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(CLAIM_SQL)
            row = cur.fetchone()
        conn.commit()
    if row is None:
        return None
    run_id, config = row
    return str(run_id), config


def _process_job(run_id: str, config_dict: dict, rw_token: str) -> str:
    config = ScenarioConfig(**config_dict)
    result = run_scenario(
        config,
        progress_cb=lambda r, year, years: print(f'  [{run_id}] {r} year {year}/{years}'),
    )
    # v1 custom-run form only offers single-region configs (no region="US"),
    # so store the same shape as a library case (a plain list of year
    # records) rather than a multi-region dict -- lets the frontend reuse
    # the exact same result-rendering components as the Library pages.
    records = _clean_records(result.regions[0].years)
    return upload_json_blob(f'runs/{run_id}.json', records, rw_token)


def main() -> None:
    env = _env()
    database_url = env['DATABASE_URL']
    rw_token = env['BLOB_READ_WRITE_TOKEN']
    engine_version = importlib.metadata.version('optimize-engine')
    print(f'run_worker starting (engine {engine_version}), polling every {POLL_INTERVAL_SECONDS}s')

    while True:
        job = _claim_job(database_url)
        if job is None:
            time.sleep(POLL_INTERVAL_SECONDS)
            continue

        run_id, config_dict = job
        print(f'--- claimed run {run_id} ---')
        try:
            blob_url = _process_job(run_id, config_dict, rw_token)
        except Exception as exc:
            print(f'  run {run_id} failed: {exc}')
            traceback.print_exc()
            with psycopg.connect(database_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(ERROR_SQL, {'id': run_id, 'error_message': str(exc)})
                conn.commit()
            continue

        print(f'  run {run_id} done -> {blob_url}')
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(DONE_SQL, {
                    'id': run_id,
                    'result_blob_url': blob_url,
                    'engine_version': engine_version,
                })
            conn.commit()


if __name__ == '__main__':
    main()
