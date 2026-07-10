import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { pool, type LibraryCaseRow } from "@/lib/db";

// case_id contains slashes (e.g. "default/default/constant_co2/co2_0_0/CAL"),
// so this is a catch-all segment -- Next.js hands us the path pieces as an
// array in params.caseId, which we rejoin to get the original case_id.
export async function GET(
  _request: Request,
  context: RouteContext<"/api/library/[...caseId]">
) {
  const { caseId } = await context.params;
  const id = caseId.join("/");

  const { rows } = await pool.query<LibraryCaseRow>(
    `SELECT * FROM library_cases WHERE case_id = $1`,
    [id]
  );
  const caseRow = rows[0];

  if (!caseRow) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const blobResult = await get(caseRow.result_blob_url, { access: "private" });
  if (!blobResult || blobResult.statusCode !== 200) {
    return NextResponse.json(
      { error: "Result blob not found" },
      { status: 502 }
    );
  }

  const years = JSON.parse(await new Response(blobResult.stream).text());

  return NextResponse.json({
    case_id: caseRow.case_id,
    group_name: caseRow.group_name,
    variant: caseRow.variant,
    co2_regime: caseRow.co2_regime,
    co2_initial: caseRow.co2_initial,
    co2_yearly: caseRow.co2_yearly,
    region: caseRow.region,
    years: caseRow.years,
    config: caseRow.config,
    engine_version: caseRow.engine_version,
    specs_version: caseRow.specs_version,
    eia_version: caseRow.eia_version,
    created_at: caseRow.created_at,
    result: years,
  });
}
