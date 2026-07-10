import { NextResponse } from "next/server";
import { getLibraryCase } from "@/lib/library";

// case_id contains slashes (e.g. "default/default/constant_co2/co2_0_0/CAL"),
// so this is a catch-all segment -- Next.js hands us the path pieces as an
// array in params.caseId, which we rejoin to get the original case_id.
export async function GET(
  _request: Request,
  context: RouteContext<"/api/library/[...caseId]">
) {
  const { caseId } = await context.params;
  const detail = await getLibraryCase(caseId.join("/"));

  if (!detail) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
