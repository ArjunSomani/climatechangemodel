import Link from "next/link";
import { getEiaIndex, getEiaRegionData } from "@/lib/eiaExplorer";
import { REGIONS } from "@/lib/regions";
import { EiaExplorerClient } from "@/components/EiaExplorerClient";

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
