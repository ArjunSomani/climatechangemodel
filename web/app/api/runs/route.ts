import { NextResponse } from "next/server";
import { insertRun, outstandingRunsCapReached } from "@/lib/runs";
import { validateScenarioConfig } from "@/lib/scenarioConfig";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const config = validateScenarioConfig(
    (body as Record<string, unknown>)?.config
  );
  if (!config) {
    return NextResponse.json({ error: "Invalid scenario config" }, { status: 400 });
  }

  // Bound worst-case load on the single free-tier worker rather than
  // letting an unbounded queue build up behind it.
  if (await outstandingRunsCapReached()) {
    return NextResponse.json(
      { error: "Too many runs in progress, please try again shortly" },
      { status: 429 }
    );
  }

  const runId = await insertRun(config);
  return NextResponse.json({ runId });
}
