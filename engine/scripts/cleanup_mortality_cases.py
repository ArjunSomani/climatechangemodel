"""Remove the experimental mortality cases from the shared library.

The mortality cases (group_name='Mortality') were seeded into the shared
Neon/Blob library so the feature could be reviewed. This script deletes them
again -- the DB-side half of "roll production back to the pre-mortality state"
(the code-side half is a Vercel Instant Rollback or a git revert).

Deleting the catalog rows is what actually removes the cases from the /library
listing; the private result blobs they point at are invisible without a row, so
blob deletion is best-effort (a failure there is logged, not fatal).

SAFE BY DEFAULT: lists what it would delete and stops. Pass --confirm to delete.

Run:  python scripts/cleanup_mortality_cases.py [--confirm]
Env:  DATABASE_URL, BLOB_READ_WRITE_TOKEN (or web/.env.local)
"""
import argparse
import os
from pathlib import Path

import psycopg

from optimize_engine.blob import delete_blobs


def _load_env() -> dict:
    env = {
        'DATABASE_URL': os.environ.get('DATABASE_URL'),
        'BLOB_READ_WRITE_TOKEN': os.environ.get('BLOB_READ_WRITE_TOKEN'),
    }
    if not env['DATABASE_URL']:
        local = Path(__file__).resolve().parent.parent.parent / 'web' / '.env.local'
        if local.exists():
            for line in local.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                v = v.strip().strip('"').strip("'")
                if k.strip() in env and not env[k.strip()]:
                    env[k.strip()] = v
    if not env['DATABASE_URL']:
        raise SystemExit('DATABASE_URL not set in env or web/.env.local')
    return env


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--confirm', action='store_true',
        help='actually delete (without this flag it is a dry run)')
    args = parser.parse_args()
    env = _load_env()

    with psycopg.connect(env['DATABASE_URL']) as conn:
        rows = conn.execute(
            "SELECT case_id, result_blob_url FROM library_cases "
            "WHERE group_name = 'Mortality' ORDER BY case_id"
        ).fetchall()

        if not rows:
            print('No mortality cases in the library. Nothing to do.')
            return

        print(f'{len(rows)} mortality case(s) found:')
        for case_id, _ in rows:
            print(f'  {case_id}')

        if not args.confirm:
            print('\nDRY RUN -- pass --confirm to delete these rows and their blobs.')
            return

        conn.execute("DELETE FROM library_cases WHERE group_name = 'Mortality'")
        conn.commit()
        print(f'\nDeleted {len(rows)} catalog row(s).')

    # Best-effort blob cleanup -- orphaned private blobs are harmless.
    token = env.get('BLOB_READ_WRITE_TOKEN')
    blob_urls = [url for _, url in rows if url]
    if token and blob_urls:
        try:
            delete_blobs(blob_urls, token)
            print(f'Deleted {len(blob_urls)} result blob(s).')
        except Exception as exc:  # noqa: BLE001 -- best effort
            print(f'WARNING: blob cleanup failed ({exc}); '
                  f'{len(blob_urls)} orphaned blob(s) left (invisible to the site).')
    elif not token:
        print('BLOB_READ_WRITE_TOKEN not set; skipped blob cleanup.')


if __name__ == '__main__':
    main()
