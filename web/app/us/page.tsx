import Link from "next/link";
import { listLibraryCases, getLibraryCases } from "@/lib/library";
import {
  aggregateRegions,
  dedupeByRegion,
  mostCompleteConfigCaseIds,
} from "@/lib/aggregate";
import { ResultCharts } from "@/components/ResultCharts";
import { ScenarioStats } from "@/components/ScenarioStats";
import { caseLabel } from "@/lib/metrics";
import { KeyPoint } from "@/components/KeyPoint";

export const metadata = {
  title: "United States — Optimize",
  description:
    "The US grid as the sum of its 13 regions — generation, capacity, emissions, deaths, and cost combined.",
};

// Reads live Neon/Blob data.
export const dynamic = "force-dynamic";

export default async function USPage() {
  const all = await listLibraryCases();
  // Prefer the per-region-growth cross-section (each region at its own historical
  // demand rate) when it's seeded; otherwise fall back to the most complete
  // uniform-growth config.
  const regional = all.filter((c) => c.group_name === "Regional_Growth");
  const perRegionGrowth = regional.length >= 2;
  const { caseIds } = perRegionGrowth
    ? { caseIds: regional.map((c) => c.case_id) }
    : mostCompleteConfigCaseIds(all);
  const cases = await getLibraryCases(caseIds);
  // Count what was actually summed, not what was requested: a case whose blob
  // failed to load is dropped by getLibraryCases, and a repeated region is
  // dropped by the aggregator, so `caseIds.length` could overstate both. The
  // headline says "Summed across N regions" and now N is that same N.
  const summed = dedupeByRegion(cases);
  const result = aggregateRegions(summed);
  const summedRegionCount = summed.length;

  if (result.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">United States</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          No regional scenarios are available to aggregate yet. Once the library
          is seeded across regions, the national total appears here.{" "}
          <Link href="/library" className="underline hover:text-accent">
            Browse the library →
          </Link>
        </p>
      </div>
    );
  }

  const scenario = caseLabel(cases[0]).replace(/^[A-Z]+ · /, ""); // drop region prefix

  const mortalityPrice = (cases[0].config as {
    mortality_price?: { initial?: number };
  } | null)?.mortality_price?.initial;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        The United States grid
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Summed across {summedRegionCount} regions · scenario:{" "}
        <span className="text-zinc-800 dark:text-zinc-200">{scenario}</span>
      </p>

      <KeyPoint tone="caveat" accent="accent" label="How to read this:">
        Because the model optimizes each region independently with no
        transmission between them, the national grid here is exactly the{" "}
        <span className="font-medium">sum of its regions</span> — an aggregate of
        independent optimizations, not a co-optimized national grid.{" "}
        {perRegionGrowth
          ? "Each region grows at its own historical demand rate (clipped 2020–2025 estimate)."
          : "Every region used the same demand-growth assumption."}
      </KeyPoint>

      <div className="mt-8">
        <ScenarioStats result={result} />
      </div>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <span className="h-3 w-1 rounded-full bg-accent" aria-hidden />
          National totals over time
        </h2>
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <ResultCharts data={result} mortalityPrice={mortalityPrice} />
        </div>
      </section>

      <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
        Want the regional detail behind this?{" "}
        <Link href="/library" className="underline hover:text-accent">
          Browse individual regions →
        </Link>
      </p>
    </div>
  );
}
