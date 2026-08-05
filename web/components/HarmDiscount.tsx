"use client";

// A discount rate on HARMS, separate from the interest rate the engine applies
// to capital. The model weights a death in 2050 like one today; this makes that
// assumption adjustable and shows what a different choice does to the present
// value of the priced harms -- and how differently it hits mortality (harm at
// the moment of emission) versus CO2 (whose damage plays out over a long tail).
import { useState } from "react";
import { presentValue, type HarmStreams } from "@/lib/discount";

const RATES = [
  { label: "0% (as the model runs)", rate: 0 },
  { label: "3%", rate: 0.03 },
  { label: "7%", rate: 0.07 },
];

function money(d: number): string {
  const abs = Math.abs(d);
  if (abs >= 1e12) return `$${(d / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(d / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(d / 1e6).toFixed(0)}M`;
  return `$${Math.round(d).toLocaleString()}`;
}

function Row({
  label,
  undiscounted,
  pv,
}: {
  label: string;
  undiscounted: number;
  pv: number;
}) {
  const drop = undiscounted > 0 ? 1 - pv / undiscounted : 0;
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-zinc-100 py-2 dark:border-zinc-800">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
        {money(pv)}
        {drop > 0.0005 ? (
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
            −{Math.round(drop * 100)}% vs {money(undiscounted)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function HarmDiscount({ streams }: { streams: HarmStreams }) {
  const [rate, setRate] = useState(0);

  if (!streams.hasMortalityPrice && !streams.hasCarbonPrice) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        This scenario prices no harms, so there is nothing to discount. A scenario
        that sets a mortality or carbon price puts a present-value cost on future
        harm — and the rate you&apos;d discount it at is a value choice this
        control makes visible.
      </p>
    );
  }

  const mortUndisc = presentValue(streams.mortalityCostPerYear, 0);
  const mortPv = presentValue(streams.mortalityCostPerYear, rate);
  const co2Undisc = presentValue(streams.co2CostPerYear, 0);
  const co2Pv = presentValue(streams.co2CostPerYear, rate);

  return (
    <div>
      <div
        role="group"
        aria-label="Harm discount rate"
        className="inline-flex flex-wrap gap-0.5 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
      >
        {RATES.map((r) => {
          const selected = r.rate === rate;
          return (
            <button
              key={r.label}
              type="button"
              aria-pressed={selected}
              onClick={() => setRate(r.rate)}
              className={
                "min-h-9 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors " +
                (selected
                  ? "bg-accent text-accent-foreground"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50")
              }
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {streams.hasMortalityPrice ? (
          <Row label="Mortality (deaths × VSL)" undiscounted={mortUndisc} pv={mortPv} />
        ) : null}
        {streams.hasCarbonPrice ? (
          <Row label="CO₂ (carbon price × emissions)" undiscounted={co2Undisc} pv={co2Pv} />
        ) : null}
      </div>

      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        Present value of the <span className="font-medium">priced</span> harms at
        a rate applied to the harms themselves — the engine already discounts
        capital separately, at its own interest rate. A higher rate shrinks
        whichever harm arrives later. One caveat this doesn&apos;t model: a ton of
        CO₂ keeps causing damage for decades after it&apos;s emitted, so its true
        harm tail is longer than the emission-year accounting here.
      </p>
    </div>
  );
}
