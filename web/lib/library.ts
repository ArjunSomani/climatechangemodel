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
