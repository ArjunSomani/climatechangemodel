"""Create/update the Neon Postgres schema for on-demand custom runs (Phase 3).

Reads DATABASE_URL from web/.env.local (pulled via `vercel env pull`).
Safe to re-run: uses CREATE TABLE IF NOT EXISTS.
"""
from pathlib import Path

import psycopg
from dotenv import dotenv_values

WEB_ENV_FILE = Path(__file__).resolve().parent.parent.parent / 'web' / '.env.local'

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS runs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config            JSONB NOT NULL,
    status            TEXT NOT NULL DEFAULT 'queued',
    result_blob_url   TEXT,
    error_message     TEXT,
    engine_version    TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_status_created
    ON runs (status, created_at);
"""


def main() -> None:
    env = dotenv_values(WEB_ENV_FILE)
    database_url = env['DATABASE_URL']

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
        conn.commit()

    print('runs table ready')


if __name__ == '__main__':
    main()
