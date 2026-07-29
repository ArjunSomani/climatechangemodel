import { get } from "@vercel/blob";
import { pool, type LibraryCaseRow } from "@/lib/db";

export type LibraryCaseSummary = Omit<
  LibraryCaseRow,
  "config" | "result_blob_url"
>;

export async function listLibraryCases(): Promise<LibraryCaseSummary[]> {
  const { rows } = await pool.query<LibraryCaseSummary>(
    `SELECT case_id, group_name, variant, co2_regime, co2_initial, co2_yearly,
            region, years, engine_version, specs_version, eia_version, created_at
     FROM library_cases
     ORDER BY group_name, variant, co2_regime, co2_initial, region`
  );
  return rows;
}

export interface YearRecord {
  Year: number;
  "CO2_M$_MT": number;
  Target_MWh: number;
  Outage_MWh: number;
  "Outage_M$_MWh": number;
  Iterations: number;
  [key: string]: number;
}

export interface LibraryCaseDetail extends LibraryCaseSummary {
  config: unknown;
  result: YearRecord[];
}

export async function getLibraryCase(
  caseId: string
): Promise<LibraryCaseDetail | null> {
  const { rows } = await pool.query<LibraryCaseRow>(
    `SELECT * FROM library_cases WHERE case_id = $1`,
    [caseId]
  );
  const caseRow = rows[0];
  if (!caseRow) return null;

  return hydrateCase(caseRow);
}

// Batch fetch. Calling getLibraryCase() per id issued one Neon round-trip per
// case on top of the unavoidable per-case Blob fetch -- 13 queries + 13 blob
// reads for /us, which measured ~1.6s to first paint. The rows all come from one
// table by primary key, so a single `= ANY($1)` collapses the SQL side to one
// round-trip; the blob reads stay parallel because each result body is a separate
// object in storage.
//
// Returned in the caller's requested id order, not the database's, so callers can
// rely on the ordering they asked for. Missing ids are dropped, matching
// getLibraryCase()'s null-for-absent contract.
export async function getLibraryCases(
  caseIds: string[]
): Promise<LibraryCaseDetail[]> {
  if (caseIds.length === 0) return [];

  const { rows } = await pool.query<LibraryCaseRow>(
    `SELECT * FROM library_cases WHERE case_id = ANY($1)`,
    [caseIds]
  );
  const byId = new Map(rows.map((r) => [r.case_id, r]));

  const details = await Promise.all(
    caseIds.map(async (id) => {
      const caseRow = byId.get(id);
      if (!caseRow) return null;
      return hydrateCase(caseRow);
    })
  );
  return details.filter((d): d is LibraryCaseDetail => d !== null);
}

// Shared by getLibraryCase and getLibraryCases: turn a row plus its blob into a
// full detail record. Kept in one place so the two entry points can never drift
// on which fields they project.
async function hydrateCase(
  caseRow: LibraryCaseRow
): Promise<LibraryCaseDetail | null> {
  const blobResult = await get(caseRow.result_blob_url, { access: "private" });
  if (!blobResult || blobResult.statusCode !== 200) return null;

  const result: YearRecord[] = JSON.parse(
    await new Response(blobResult.stream).text()
  );

  return {
    case_id: caseRow.case_id,
    group_name: caseRow.group_name,
    variant: caseRow.variant,
    co2_regime: caseRow.co2_regime,
    co2_initial: caseRow.co2_initial,
    co2_yearly: caseRow.co2_yearly,
    region: caseRow.region,
    years: caseRow.years,
    engine_version: caseRow.engine_version,
    specs_version: caseRow.specs_version,
    eia_version: caseRow.eia_version,
    created_at: caseRow.created_at,
    config: caseRow.config,
    result,
  };
}
