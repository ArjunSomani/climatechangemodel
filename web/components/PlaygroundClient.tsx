"use client";

import { useState } from "react";
import { SOURCES } from "@/lib/sources";
import { formatVsl } from "@/lib/mortality";
import { abatementVsBaseline, cellAt, type Lattice } from "@/lib/playground";
import { ChartCaption } from "@/components/ChartCaption";

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
  // Open mid-demonstration rather than at $0/$0 (where every "vs no pricing"
  // panel is an em-dash and nothing has happened yet): carbon off, mortality at
  // the grid point nearest the central VSL, so the page loads already showing
  // coal collapsing under a mortality price.
  const CENTRAL_VSL = 14_100_000;
  const defaultMi = lattice.mortalityPrices.reduce(
    (best, p, i, arr) =>
      Math.abs(p - CENTRAL_VSL) < Math.abs(arr[best] - CENTRAL_VSL) ? i : best,
    0
  );
  const [ci, setCi] = useState(0); // carbon price index
  const [mi, setMi] = useState(defaultMi); // mortality price index

  const cell = cellAt(lattice, ci, mi);
  const baseline = cellAt(lattice, 0, 0);
  const carbon = lattice.carbonPrices[ci];
  const mort = lattice.mortalityPrices[mi];

  const total = SOURCES.reduce(
    (s, src) => s + (cell.finalMixMWh[src.key] ?? 0),
    0
  );
  const deathsAvoided = baseline.deathsCentral - cell.deathsCentral;
  const co2Avoided = baseline.co2FinalMT - cell.co2FinalMT;

  // Marginal abatement cost vs the no-pricing baseline, over the full horizon.
  const mac = abatementVsBaseline(cell, baseline);
  const priced = ci > 0 || mi > 0;

  return (
    <div className="space-y-8">
      {/* Sliders */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="pg-carbon" className="text-sm font-medium">
              Carbon price
            </label>
            <span className="text-sm tabular-nums">
              ${carbon.toLocaleString()}/ton
            </span>
          </div>
          {/* These sliders are index sliders -- their value is a position in the
              pre-computed lattice, not a price -- so without aria-valuetext a
              screen reader announces "7" while the screen reads "$400/ton".
              aria-valuetext replaces the number with the thing it means.
              min-h-6 gives the control a >=24px pointer target (WCAG 2.5.8);
              the native track is 16px. */}
          <input
            id="pg-carbon"
            type="range"
            min={0}
            max={lattice.carbonPrices.length - 1}
            step={1}
            value={ci}
            aria-valuetext={`$${carbon.toLocaleString()} per ton`}
            onChange={(e) => setCi(Number(e.target.value))}
            className="mt-2 min-h-6 w-full"
            style={{ accentColor: "var(--series-coal)" }}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="pg-mort" className="text-sm font-medium">
              Mortality price
            </label>
            <span className="text-sm tabular-nums">
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
            aria-valuetext={`${formatVsl(mort)} per death`}
            onChange={(e) => setMi(Number(e.target.value))}
            className="mt-2 min-h-6 w-full"
            style={{ accentColor: "var(--mortality)" }}
          />
        </div>
      </div>

      {/* Resulting final-year mix */}
      <div>
        <ChartCaption className="mb-2">
          Final-year generation mix ({lattice.region}, year {lattice.years})
        </ChartCaption>
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
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                {fmtTwh(cell.finalMixMWh[s.key] ?? 0)} TWh
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Metrics -- each externality paired with what pricing avoids vs the
          no-pricing baseline (top-left cell). */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          label="Deaths, final year"
          value={fmt(cell.deathsCentral)}
          sub={`up to ${fmt(cell.deathsHigh)}`}
          tone="mortality"
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
        <Metric
          label="CO₂, final year"
          value={`${fmt(cell.co2FinalMT)}`}
          sub="MT"
        />
        <Metric
          label="CO₂ vs no pricing"
          value={
            co2Avoided > 0.5
              ? `−${fmt(co2Avoided)} MT`
              : co2Avoided < -0.5
                ? `+${fmt(-co2Avoided)} MT`
                : "—"
          }
          sub={co2Avoided > 0.5 ? "avoided / yr" : "vs $0 / $0"}
        />
      </div>

      {/* Marginal abatement cost: not what the grid costs, but what buying the
          reduction costs -- and whether the death reductions came in under the
          price the user set. */}
      <MacPanel
        priced={priced}
        dollarsPerTonCO2={mac.dollarsPerTonCO2}
        dollarsPerDeath={mac.dollarsPerDeath}
        vsl={mort}
      />

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        A pre-computed grid for {lattice.region} over {lattice.years}{" "}
        years — the sliders snap to grid points. Watch where coal leaves under
        either price, and where the <strong>gas</strong> share diverges: a
        mortality price keeps more gas than a carbon price of comparable bite.
      </p>
    </div>
  );
}

function dollarsPerTon(v: number): string {
  return `$${Math.round(v).toLocaleString()}/ton`;
}

function MacPanel({
  priced,
  dollarsPerTonCO2,
  dollarsPerDeath,
  vsl,
}: {
  priced: boolean;
  dollarsPerTonCO2: number | null;
  dollarsPerDeath: number | null;
  vsl: number;
}) {
  if (!priced) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Move a slider off zero to see the{" "}
        <span className="font-medium">marginal abatement cost</span> — what the
        reduction costs per ton of CO₂ and per death avoided, over the whole
        horizon.
      </div>
    );
  }

  // The consistency check: is the implied cost of an avoided death above or below
  // the VSL the user set? Only meaningful when a mortality price is actually on
  // (vsl > 0) and deaths were avoided.
  let verdict: React.ReactNode = null;
  if (vsl > 0 && dollarsPerDeath != null) {
    const under = dollarsPerDeath < vsl;
    verdict = (
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        You priced a death at{" "}
        <span className="font-medium" style={{ color: "var(--mortality)" }}>
          {formatVsl(vsl)}
        </span>
        . The grid avoided them at an implied{" "}
        <span className="font-medium">{formatVsl(dollarsPerDeath)}</span> each —{" "}
        {under ? (
          <>
            <span className="font-medium">less</span> than your price, so the
            reduction cost less than you said a life is worth.
          </>
        ) : (
          <>
            <span className="font-medium">more</span> than your price, so it&apos;s
            buying reductions above your own stated value.
          </>
        )}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        What the reduction costs (vs no pricing, whole horizon)
      </div>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Per ton CO₂ avoided
          </div>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums">
            {dollarsPerTonCO2 != null ? dollarsPerTon(dollarsPerTonCO2) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Per death avoided
          </div>
          <div
            className="mt-0.5 text-2xl font-semibold tabular-nums"
            style={{ color: "var(--mortality)" }}
          >
            {dollarsPerDeath != null ? `${formatVsl(dollarsPerDeath)}` : "—"}
          </div>
        </div>
      </div>
      {verdict}
      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        Each figure attributes the full extra system cost to that one axis, so
        read them one slider at a time: the per-ton number is cleanest with only
        the carbon price on, the per-death number with only the mortality price on.
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
        <div className="text-xs text-zinc-500 dark:text-zinc-400">{sub}</div>
      )}
    </div>
  );
}
