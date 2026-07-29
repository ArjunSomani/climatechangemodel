"use client";

// A small metric switcher over a result's year-by-year data, so a case can be
// read as more than just its generation mix. Generation (what actually ran) and
// installed capacity (what got built) are different stories; both come straight
// from clean per-year engine fields (_MWh, _MW). More metrics (utilization,
// emissions, and an engine-backed cost breakdown) plug in here as they land.
import { useState } from "react";
import { EnergyMixChart } from "@/components/EnergyMixChart";
import { CapacityChart } from "@/components/CapacityChart";
import { CapacityFactorChart } from "@/components/CapacityFactorChart";
import { EmissionsChart } from "@/components/EmissionsChart";
import { CostChart } from "@/components/CostChart";
import type { YearRecord } from "@/lib/library";

// Static imports on purpose. Only one metric renders at a time, so lazy-loading
// the four non-default charts looks like an obvious win -- it was measured and it
// isn't. All five share Recharts, which is the overwhelming majority of the
// weight (~125 KB gzipped), and the default Generation chart needs it for the
// first paint regardless. Splitting the siblings moved 4 KB over the wire and
// bought four extra chunks plus four loading states. The floor on a chart route
// is Recharts itself; the only thing that would actually move it is deferring the
// whole panel below the fold, which costs the SSR'd chart on a page whose entire
// purpose is that chart.

type MetricKey =
  | "generation"
  | "capacity"
  | "utilization"
  | "emissions"
  | "cost";

const METRICS: { key: MetricKey; label: string; caption: string }[] = [
  {
    key: "generation",
    label: "Generation",
    caption:
      "Electricity actually produced each year (MWh), stacked by source — what the grid ran on.",
  },
  {
    key: "capacity",
    label: "Capacity",
    caption:
      "Generating capacity built and standing each year (MW) — what's available, whether or not it runs. Capacity and generation diverge: a plant that rarely runs is large in MW but small in MWh.",
  },
  {
    key: "utilization",
    label: "Utilization",
    caption:
      "Capacity factor by source — the share of the time each source's capacity is actually producing. Nuclear runs almost always; solar only when the sun is up.",
  },
  {
    key: "emissions",
    label: "Emissions",
    caption:
      "Annual CO₂ (Mt), computed from generation × each source's carbon intensity.",
  },
  {
    key: "cost",
    label: "Cost",
    caption:
      "Annual system cost by component (M$): capital + fixed O&M from the engine's annual fields, variable O&M and CO₂ cost recomputed to match the engine, plus mortality cost (deaths × VSL) when the case prices it.",
  },
];

export function ResultCharts({
  data,
  mortalityPrice,
}: {
  data: YearRecord[];
  mortalityPrice?: number;
}) {
  const [metric, setMetric] = useState<MetricKey>("generation");
  const active = METRICS.find((m) => m.key === metric)!;

  return (
    <div>
      {/* A group of toggle buttons, not an ARIA tablist. The tablist role
          carries a keyboard contract -- roving tabindex, Arrow/Home/End moving
          selection, each tab owning an aria-controls'd tabpanel -- and claiming
          the role without honoring it is worse than not claiming it: the screen
          reader announces "tab 1 of 5", the user presses Right, nothing moves.
          Five chart metrics don't need that contract, so we use the affordance
          that's true here: pressed buttons, native Tab between them, one live
          region announcing what changed.

          flex-wrap matters: the five labels measure ~419px, which overflowed a
          360px viewport and put a horizontal scrollbar on the whole page. It
          stays inline-flex so the group still hugs its content on wide screens
          rather than stretching into a full-width segmented control. */}
      <div
        role="group"
        aria-label="Chart metric"
        className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
      >
        {METRICS.map((m) => {
          const selected = m.key === metric;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setMetric(m.key)}
              className={
                "min-h-9 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors " +
                (selected
                  ? "bg-accent text-accent-foreground"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50")
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {metric === "generation" && <EnergyMixChart data={data} />}
        {metric === "capacity" && <CapacityChart data={data} />}
        {metric === "utilization" && <CapacityFactorChart data={data} />}
        {metric === "emissions" && <EmissionsChart data={data} />}
        {metric === "cost" && (
          <CostChart data={data} mortalityPrice={mortalityPrice} />
        )}
      </div>
      {/* The caption is the only text that changes when the metric does, so it
          doubles as the announcement -- a screen-reader user gets the new
          metric's description instead of silence after a swap. */}
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-sm text-zinc-500 dark:text-zinc-400"
      >
        <span className="sr-only">{active.label}: </span>
        {active.caption}
      </p>
    </div>
  );
}
