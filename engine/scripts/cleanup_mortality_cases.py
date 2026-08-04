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
from dotenv import dotenv_values

from optimize_engine.blob import delete_blobs


def _load_env() -> dict:
    """Read both secrets from the environment, falling back to web/.env.local.

    Two fixes over the original here. It only consulted the file when
    DATABASE_URL was missing, so a shell with DATABASE_URL exported but no
    BLOB_READ_WRITE_TOKEN never read the file and silently skipped blob cleanup
    ("BLOB_READ_WRITE_TOKEN not set") even though the token was sitting right
    there. And it hand-rolled a .env parser that mishandles quoting and `export`
    prefixes, while python-dotenv is already a dependency and is what every
    sibling script uses.
    """
    env = {
        'DATABASE_URL': os.environ.get('DATABASE_URL'),
        'BLOB_READ_WRITE_TOKEN': os.environ.get('BLOB_READ_WRITE_TOKEN'),
    }
    if not all(env.values()):
        local_path = Path(__file__).resolve().parent.parent.parent / 'web' / '.env.local'
        local = dotenv_values(local_path) if local_path.exists() else {}
        for key in env:
            env[key] = env[key] or local.get(key)

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

        # Delete by the exact case_ids listed above, not by re-running the
        # predicate. Re-evaluating `group_name = 'Mortality'` at delete time
        # means anything seeded between the dry run and the confirm gets removed
        # without ever being shown or approved -- and the count printed
        # afterwards came from the earlier SELECT, so it could be wrong in either
        # direction. Deleting a known id list makes the confirmation prompt an
        # accurate description of what happens.
        case_ids = [case_id for case_id, _ in rows]
        deleted = conn.execute(
            "DELETE FROM library_cases WHERE case_id = ANY(%s)", (case_ids,)
        ).rowcount
        conn.commit()
        print(f'\nDeleted {deleted} catalog row(s).')
        if deleted != len(rows):
            print(f'  (listed {len(rows)}; {len(rows) - deleted} had already gone)')

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
