"use client";

import { useState } from "react";
import { SOURCES } from "@/lib/sources";
import { formatVsl } from "@/lib/mortality";
import { cellAt, type Lattice } from "@/lib/playground";

function fmt(n: number): string {
  if (n < 10) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return Math.round(n).toLocaleString();
}

function fmtTwh(mwh: number): string {
  return (mwh / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

export function PlaygroundClient({ lattice }: { lattice: Lattice }) {
  const [ci, setCi] = useState(0); // carbon price index
  const [mi, setMi] = useState(0); // mortality price index

  const cell = cellAt(lattice, ci, mi);
  const baseline = cellAt(lattice, 0, 0);
  const carbon = lattice.carbonPrices[ci];
  const mort = lattice.mortalityPrices[mi];

  const total = SOURCES.reduce(
    (s, src) => s + (cell.finalMixMWh[src.key] ?? 0),
    0
  );
  const deathsAvoided = baseline.deathsCentral - cell.deathsCentral;

  return (
    <div className="space-y-8">
      {/* Sliders */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="pg-carbon" className="text-sm font-medium">
              Carbon price
            </label>
            <span className="font-mono text-sm tabular-nums">
              ${carbon.toLocaleString()}/ton
            </span>
          </div>
          <input
            id="pg-carbon"
            type="range"
            min={0}
            max={lattice.carbonPrices.length - 1}
            step={1}
            value={ci}
            onChange={(e) => setCi(Number(e.target.value))}
            className="mt-2 w-full"
            style={{ accentColor: "var(--series-coal)" }}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="pg-mort" className="text-sm font-medium">
              Mortality price
            </label>
            <span className="font-mono text-sm tabular-nums">
              {formatVsl(mort)}/death
            </span>
          </div>
          <input
            id="pg-mort"
            type="range"
            min={0}
            max={lattice.mortalityPrices.length - 1}
            step={1}
            value={mi}
            onChange={(e) => setMi(Number(e.target.value))}
            className="mt-2 w-full"
            style={{ accentColor: "var(--mortality)" }}
          />
        </div>
      </div>

      {/* Resulting final-year mix */}
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Final-year generation mix ({lattice.region}, year {lattice.years})
        </div>
        <div
          className="flex h-8 w-full overflow-hidden rounded-md"
          role="img"
          aria-label={
            "Generation mix: " +
            SOURCES.map(
              (s) =>
                `${s.label} ${Math.round(
                  (100 * (cell.finalMixMWh[s.key] ?? 0)) / (total || 1)
                )}%`
            ).join(", ")
          }
        >
          {SOURCES.map((s) => {
            const pct = (100 * (cell.finalMixMWh[s.key] ?? 0)) / (total || 1);
            if (pct <= 0) return null;
            return (
              <div
                key={s.key}
                style={{ width: `${pct}%`, background: s.color }}
                title={`${s.label}: ${fmtTwh(cell.finalMixMWh[s.key] ?? 0)} TWh`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
          {SOURCES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: s.color }}
              />
              {s.label}{" "}
              <span className="tabular-nums text-zinc-400">
                {fmtTwh(cell.finalMixMWh[s.key] ?? 0)} TWh
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Metric
          label="Deaths, final year"
          value={fmt(cell.deathsCentral)}
          sub={`band ${fmt(cell.deathsLow)}–${fmt(cell.deathsHigh)}`}
          tone="mortality"
        />
        <Metric
          label="CO₂, final year"
          value={`${fmt(cell.co2FinalMT)}`}
          sub="MT"
        />
        <Metric
          label="Deaths vs no pricing"
          value={
            deathsAvoided > 0.5
              ? `−${fmt(deathsAvoided)}`
              : deathsAvoided < -0.5
                ? `+${fmt(-deathsAvoided)}`
                : "—"
          }
          sub={deathsAvoided > 0.5 ? "avoided / yr" : "vs $0 / $0"}
          tone="mortality"
        />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        A coarse pre-computed grid for {lattice.region} over {lattice.years}{" "}
        years — the sliders snap to grid points. Watch where coal leaves under
        either price, and where the <strong>gas</strong> share diverges: a
        mortality price keeps more gas than a carbon price of comparable bite.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "mortality";
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div
        className="mt-0.5 text-2xl font-semibold tabular-nums"
        style={tone === "mortality" ? { color: "var(--mortality)" } : undefined}
      >
        {value}
      </div>
      {sub && (
        <div className="text-xs text-zinc-400">{sub}</div>
      )}
    </div>
  );
}
