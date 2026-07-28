import latticeData from "@/data/playground_lattice.json";
import { SOURCES } from "@/lib/sources";
import { formatVsl } from "@/lib/mortality";
import type { Lattice } from "@/lib/playground";

const lattice = latticeData as Lattice;

// Pre-computed demonstration of what pricing each externality does, straight
// from the playground lattice (no run required). The honest finding: coal
// collapses and deaths fall ~90% under EITHER price -- and the two regimes
// reach nearly the same mix, because over this horizon build-rate limits keep
// gas in both. The disagreement is in the marginal cost ($347 vs $39/MWh
// above), not yet the built mix.
const CARBON_HI = lattice.carbonPrices.length - 1;
const MORT_HI = lattice.mortalityPrices.length - 1;

const REGIMES: { label: string; ci: number; mi: number }[] = [
  { label: "No pricing", ci: 0, mi: 0 },
  { label: `Carbon only ($${lattice.carbonPrices[CARBON_HI]}/ton)`, ci: CARBON_HI, mi: 0 },
  { label: `Mortality only (${formatVsl(lattice.mortalityPrices[MORT_HI])})`, ci: 0, mi: MORT_HI },
  { label: "Both", ci: CARBON_HI, mi: MORT_HI },
];

function twh(mwh: number): string {
  return (mwh / 1_000_000).toFixed(0);
}

export function DivergenceComparison() {
  const rows = REGIMES.map((r) => {
    const cell = lattice.cells[`${r.ci}_${r.mi}`];
    const total = SOURCES.reduce((s, src) => s + (cell.finalMixMWh[src.key] ?? 0), 0);
    return { ...r, cell, total };
  });

  return (
    <figure className="my-0">
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                coal {twh(r.cell.finalMixMWh.Coal ?? 0)} · gas{" "}
                {twh(r.cell.finalMixMWh.Gas ?? 0)} TWh ·{" "}
                <span style={{ color: "var(--mortality)" }}>
                  {Math.round(r.cell.deathsCentral).toLocaleString()} deaths
                </span>
              </span>
            </div>
            <div
              className="mt-1 flex h-6 w-full overflow-hidden rounded-sm"
              role="img"
              aria-label={
                `${r.label}: ` +
                SOURCES.map(
                  (s) => `${s.label} ${twh(r.cell.finalMixMWh[s.key] ?? 0)} TWh`
                ).join(", ")
              }
            >
              {SOURCES.map((s) => {
                const pct = (100 * (r.cell.finalMixMWh[s.key] ?? 0)) / (r.total || 1);
                if (pct <= 0) return null;
                return (
                  <div
                    key={s.key}
                    style={{ width: `${pct}%`, background: s.color }}
                    title={`${s.label}: ${twh(r.cell.finalMixMWh[s.key] ?? 0)} TWh`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {SOURCES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>

      <figcaption className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Final-year mix for {lattice.region} over {lattice.years} years, from the
        pre-computed grid. Coal collapses and deaths fall ~90% under{" "}
        <em>either</em> price. Notice the two single-price columns look almost
        the same: over this horizon, build-rate limits keep gas in both, so the
        disagreement stays in the marginal cost ($347 vs $39/MWh) rather than
        the built mix. Push the horizon or the prices further in the{" "}
        <a href="/playground" className="underline hover:text-accent">
          playground
        </a>
        .
      </figcaption>
    </figure>
  );
}
