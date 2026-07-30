import { tryReadBlobText } from "@/lib/blobRead";
import { pool } from "@/lib/db";
import type { YearRecord } from "@/lib/library";
import type { ScenarioConfigInput } from "@/lib/scenarioConfig";

// Server-only (imports pg via lib/db.ts + @vercel/blob) -- do not import
// from a client component. See lib/metrics.ts for the split pattern.

export type RunStatus = "queued" | "running" | "done" | "error";

export interface RunRow {
  id: string;
  config: ScenarioConfigInput;
  status: RunStatus;
  result_blob_url: string | null;
  error_message: string | null;
  engine_version: string;
  created_at: string;
  updated_at: string;
}

const MAX_OUTSTANDING_RUNS = 5;

export async function countOutstandingRuns(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM runs WHERE status IN ('queued', 'running')`
  );
  return Number(rows[0].count);
}

export async function outstandingRunsCapReached(): Promise<boolean> {
  return (await countOutstandingRuns()) >= MAX_OUTSTANDING_RUNS;
}

export async function insertRun(config: ScenarioConfigInput): Promise<string> {
  // engine_version is filled in by run_worker.py once it actually processes
  // the job -- the frontend has no way to know it up front.
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO runs (config) VALUES ($1) RETURNING id`,
    [JSON.stringify(config)]
  );
  return rows[0].id;
}

export interface RunStatusDetail {
  status: RunStatus;
  errorMessage: string | null;
  config: ScenarioConfigInput | null;
  result: YearRecord[] | null;
}

// `runs.id` is a uuid column, so Postgres rejects anything that isn't one with
// `invalid input syntax for type uuid` -- an exception, not an empty result. The
// id arrives from a URL path segment, so any hand-typed or stale link (e.g.
// /custom-run/does-not-exist) turned a should-be-404 into a 500 plus a database
// error in the logs, repeated on every poll of the status page. Shape-check first
// and treat a non-uuid as simply not found, which is what it is.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getRunStatus(id: string): Promise<RunStatusDetail | null> {
  if (!UUID_RE.test(id)) return null;

  const { rows } = await pool.query<RunRow>(`SELECT * FROM runs WHERE id = $1`, [id]);
  const row = rows[0];
  if (!row) return null;

  if (row.status !== "done" || !row.result_blob_url) {
    return {
      status: row.status,
      errorMessage: row.error_message,
      config: row.config,
      result: null,
    };
  }

  // tryReadBlobText, not readBlobText: this function already has a graceful
  // "Result blob unavailable" status below, and the status page polls -- so
  // degrading lets the next poll succeed, where throwing would replace a live
  // status page with an error page.
  const blobBody = await tryReadBlobText(row.result_blob_url);
  if (blobBody === null) {
    return {
      status: "error",
      errorMessage: "Result blob unavailable",
      config: row.config,
      result: null,
    };
  }

  const result: YearRecord[] = JSON.parse(blobBody);
  return { status: "done", errorMessage: null, config: row.config, result };
}
