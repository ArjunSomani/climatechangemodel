import Link from "next/link";
import { getEiaIndex, getEiaRegionData } from "@/lib/eiaExplorer";
import { REGIONS } from "@/lib/regions";
import { EiaExplorerClient } from "@/components/EiaExplorerClient";
import { mixWeightedDeathsPerTwh } from "@/lib/mortality";
import {
  SafetyCallout,
  AttributionNote,
  UncertaintyBandNote,
} from "@/components/SafetyDisclosure";

export const metadata = {
  title: "Data Explorer — Optimize",
  description: "Explore the raw EIA hourly generation data behind the model.",
};

export const dynamic = "force-dynamic";

export default async function DataExplorerPage({
  searchParams,
}: PageProps<"/data-explorer">) {
  const params = await searchParams;
  const region =
    typeof params.region === "string" ? params.region : "CAL";

  const index = await getEiaIndex();
  const data = await getEiaRegionData(region);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Data Explorer</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        The raw EIA hourly generation data behind every scenario &mdash;
        aggregated so it&rsquo;s actually readable.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(index?.regions ?? Object.keys(REGIONS)).map((r) => (
          <Link
            key={r}
            href={`/data-explorer?region=${r}`}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm ${
              r === region
                ? "border-accent bg-accent text-accent-foreground"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            {REGIONS[r] ?? r}
          </Link>
        ))}
      </div>

      {data && <SafetyLens data={data} />}

      {data ? (
        <div className="mt-8">
          <EiaExplorerClient
            data={data}
            dateRange={
              index?.date_range ?? [
                `${Math.min(...data.yearly_max_mw.map((r) => r.year))}-01-01`,
                `${Math.max(...data.yearly_max_mw.map((r) => r.year))}-12-31`,
              ]
            }
          />
        </div>
      ) : (
        <p className="mt-8 text-zinc-500 dark:text-zinc-400">
          No data available for this region yet.
        </p>
      )}

      {index && (
        <p className="mt-12 text-xs text-zinc-500 dark:text-zinc-400">
          Source: US Energy Information Administration, hourly generation by
          fuel type, {new Date(index.date_range[0]).toLocaleDateString()}
          {" – "}
          {new Date(index.date_range[1]).toLocaleDateString()}. Data version{" "}
          {index.eia_version}.
        </p>
      )}
    </div>
  );
}

// Descriptive safety lens: what this region's *actual* recent generation mix
// implies in deaths per TWh, weighting each source's rate by its share of a
// typical day's output. Not a model run -- a read on the real grid.
function SafetyLens({
  data,
}: {
  data: import("@/lib/eiaExplorer").EiaRegionData;
}) {
  // typical_day holds capacity *fractions* (0–1), not generation. Weighting the
  // mix by fraction alone over-weights small-but-often-running sources (coal,
  // oil) and understates big low-capacity-factor ones (solar). Generation ≈
  // capacity fraction × capacity MW, so combine typical_day with the peak-MW
  // table to get a generation-proportional weight per source.
  const hours = data.typical_day.length || 1;
  const avgFrac: Record<string, number> = {};
  for (const row of data.typical_day) {
    for (const [k, v] of Object.entries(row)) {
      if (k === "hour" || typeof v !== "number") continue;
      avgFrac[k] = (avgFrac[k] ?? 0) + v / hours;
    }
  }

  const years = data.yearly_max_mw.length || 1;
  const avgMaxMw: Record<string, number> = {};
  for (const row of data.yearly_max_mw) {
    for (const [k, v] of Object.entries(row)) {
      if (k === "year" || typeof v !== "number") continue;
      avgMaxMw[k] = (avgMaxMw[k] ?? 0) + v / years;
    }
  }

  const genWeight: Record<string, number> = {};
  for (const k of Object.keys(avgFrac)) {
    genWeight[k] = avgFrac[k] * (avgMaxMw[k] ?? 0);
  }
  const risk = mixWeightedDeathsPerTwh(genWeight);
  if (risk.coveredShare === 0) return null;

  return (
    <div className="mt-8">
      <SafetyCallout tone="grave">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-semibold tabular-nums text-black dark:text-zinc-50">
            {risk.deathsPerTwh.toFixed(1)}
          </span>
          <span className="text-sm">
            deaths per TWh (central) — this region&apos;s recent generation mix
          </span>
        </div>
        <p className="mt-2 text-sm">
          Not a model projection — what this region&apos;s grid{" "}
          <em>actually ran on</em>, read as lives. Coal-heavy regions (the
          Midwest and Plains today) sit highest; renewable- and nuclear-heavy
          regions lowest. About {Math.round(risk.modeledShare * 100)}% of it is
          modeled (air-pollution/radiation) rather than counted accidents.
          Covers {Math.round(risk.coveredShare * 100)}% of generation (the rest
          is &ldquo;other,&rdquo; which has no single coefficient). See the{" "}
          <Link href="/safety" className="underline hover:text-accent">
            risk ladder
          </Link>{" "}
          for the per-source rates.
        </p>
        <div className="mt-2 space-y-2">
          <UncertaintyBandNote />
          <AttributionNote />
        </div>
      </SafetyCallout>
    </div>
  );
}
