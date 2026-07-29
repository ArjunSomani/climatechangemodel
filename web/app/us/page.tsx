import Link from "next/link";
import { listLibraryCases, getLibraryCases } from "@/lib/library";
import { aggregateRegions, mostCompleteConfigCaseIds } from "@/lib/aggregate";
import { ResultCharts } from "@/components/ResultCharts";
import { co2MtFromGeneration } from "@/lib/co2";
import { computeYearDeaths } from "@/lib/mortality";
import { caseLabel } from "@/lib/metrics";
import { formatCO2, formatEnergy } from "@/lib/format";

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
  const { caseIds, regionCount } = perRegionGrowth
    ? { caseIds: regional.map((c) => c.case_id), regionCount: regional.length }
    : mostCompleteConfigCaseIds(all);
  const cases = await getLibraryCases(caseIds);
  const result = aggregateRegions(cases);

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
  const last = result[result.length - 1];
  const totalMwh = last.Target_MWh;
  const totalCo2 = co2MtFromGeneration(last);
  const totalDeaths = computeYearDeaths(last).central;

  const mortalityPrice = (cases[0].config as {
    mortality_price?: { initial?: number };
  } | null)?.mortality_price?.initial;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
        All 13 regions combined
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        The United States grid
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Summed across {regionCount} regions · scenario:{" "}
        <span className="text-zinc-800 dark:text-zinc-200">{scenario}</span>
      </p>

      <div className="mt-4 rounded-xl border-l-2 border-accent bg-zinc-50/60 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
        Because the model optimizes each region independently with no
        transmission between them, the national grid here is exactly the{" "}
        <span className="font-medium">sum of its regions</span> — an aggregate of
        independent optimizations, not a co-optimized national grid.{" "}
        {perRegionGrowth
          ? "Each region grows at its own historical demand rate (clipped 2020–2025 estimate)."
          : "Every region used the same demand-growth assumption."}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <Stat label="Final-year demand" value={formatEnergy(totalMwh)} />
        <Stat label="Final-year CO₂" value={formatCO2(totalCo2)} />
        <Stat
          label="Final-year deaths"
          value={Math.round(totalDeaths).toLocaleString()}
        />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="font-display mt-1 text-2xl font-medium">{value}</div>
    </div>
  );
}
