import { NextResponse } from "next/server";
import { listLibraryCases } from "@/lib/library";

// Not cached (default for route handlers) -- library rows change when
// generate_library.py is re-run, and this is a small/cheap query.
export async function GET() {
  const cases = await listLibraryCases();
  return NextResponse.json({ cases });
}
