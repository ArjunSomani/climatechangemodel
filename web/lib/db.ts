import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

// Reuse the pool across hot-reloads in dev / across warm serverless
// invocations, rather than opening a new connection per request.
export const pool =
  global._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}

export interface LibraryCaseRow {
  case_id: string;
  group_name: string;
  variant: string;
  co2_regime: string;
  co2_initial: number;
  co2_yearly: number;
  region: string;
  years: number;
  config: unknown;
  result_blob_url: string;
  engine_version: string;
  specs_version: string;
  eia_version: string;
  created_at: string;
}
