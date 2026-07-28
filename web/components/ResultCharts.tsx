"use client";

// A small metric switcher over a result's year-by-year data, so a case can be
// read as more than just its generation mix. Generation (what actually ran) and
// installed capacity (what got built) are different stories; both come straight
// from clean per-year engine fields (_MWh, _MW). More metrics (utilization,
// emissions, and an engine-backed cost breakdown) plug in here as they land.
import { useState } from "react";
import { EnergyMixChart } from "@/components/EnergyMixChart";
import { CapacityChart } from "@/components/CapacityChart";
import type { YearRecord } from "@/lib/library";

type MetricKey = "generation" | "capacity";

const METRICS: { key: MetricKey; label: string; caption: string }[] = [
  {
    key: "generation",
    label: "Generation",
    caption:
      "Electricity actually produced each year (MWh), stacked by source — what the grid ran on.",
  },
  {
    key: "capacity",
    label: "Installed capacity",
    caption:
      "Generating capacity built and standing each year (MW) — what's available, whether or not it runs. Capacity and generation diverge: a plant that rarely runs is large in MW but small in MWh.",
  },
];

export function ResultCharts({ data }: { data: YearRecord[] }) {
  const [metric, setMetric] = useState<MetricKey>("generation");
  const active = METRICS.find((m) => m.key === metric)!;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Chart metric"
        className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
      >
        {METRICS.map((m) => {
          const selected = m.key === metric;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMetric(m.key)}
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (selected
                  ? "bg-accent text-accent-foreground"
                  : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50")
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {metric === "generation" ? (
          <EnergyMixChart data={data} />
        ) : (
          <CapacityChart data={data} />
        )}
      </div>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {active.caption}
      </p>
    </div>
  );
}
