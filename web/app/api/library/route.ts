import { NextResponse } from "next/server";
import { pool, type LibraryCaseRow } from "@/lib/db";

// Not cached (default for route handlers) -- library rows change when
// generate_library.py is re-run, and this is a small/cheap query.
export async function GET() {
  const { rows } = await pool.query<
    Omit<LibraryCaseRow, "config" | "result_blob_url">
  >(
    `SELECT case_id, group_name, variant, co2_regime, co2_initial, co2_yearly,
            region, years, engine_version, specs_version, eia_version, created_at
     FROM library_cases
     ORDER BY group_name, variant, co2_regime, co2_initial, region`
  );

  return NextResponse.json({ cases: rows });
}
