"""Create/update the Neon Postgres schema for the library catalog (PRD §11.5).

Reads DATABASE_URL from web/.env.local (pulled via `vercel env pull`).
Safe to re-run: uses CREATE TABLE IF NOT EXISTS.
"""
from pathlib import Path

import psycopg
from dotenv import dotenv_values

WEB_ENV_FILE = Path(__file__).resolve().parent.parent.parent / 'web' / '.env.local'

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS library_cases (
    case_id           TEXT PRIMARY KEY,
    group_name        TEXT NOT NULL,
    variant           TEXT NOT NULL,
    co2_regime        TEXT NOT NULL,
    co2_initial       DOUBLE PRECISION NOT NULL,
    co2_yearly        DOUBLE PRECISION NOT NULL,
    region            TEXT NOT NULL,
    years             INTEGER NOT NULL,
    config            JSONB NOT NULL,
    result_blob_url   TEXT NOT NULL,
    engine_version    TEXT NOT NULL,
    specs_version     TEXT NOT NULL,
    eia_version       TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_cases_facets
    ON library_cases (group_name, variant, co2_regime, region);
"""


def main() -> None:
    env = dotenv_values(WEB_ENV_FILE)
    database_url = env['DATABASE_URL']

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
        conn.commit()

    print('library_cases table ready')


if __name__ == '__main__':
    main()
