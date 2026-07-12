import { NextResponse } from "next/server";
import { getRunStatus } from "@/lib/runs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/runs/[id]">
) {
  const { id } = await context.params;
  const detail = await getRunStatus(id);

  if (!detail) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
