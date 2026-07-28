import latticeData from "@/data/playground_lattice.json";
import { SOURCES } from "@/lib/sources";
import { formatVsl } from "@/lib/mortality";
import type { Lattice } from "@/lib/playground";

const lattice = latticeData as Lattice;

// Pre-computed demonstration of what pricing each externality does, straight
// from the playground lattice (no run required). The finding, over the full
// 25-year horizon: coal collapses and deaths fall ~95%+ under EITHER price --
// but the two regimes now DIVERGE on gas. A carbon price squeezes gas hard; a
// mortality price leaves far more of it, because gas is carbon-heavy but
// comparatively low-mortality. The disagreement ($347 vs $39/MWh in marginal
// cost) reaches the built mix once the horizon stops binding.
const CARBON_HI = lattice.carbonPrices.length - 1;
// Compare at the published high VSL ($21.5M), not the grid's top ($24M, chosen
// to match the $400 carbon bite), so every regime stays inside HHS's range.
const MORT_HI = lattice.mortalityPrices.reduce(
  (best, p, i, arr) =>
    Math.abs(p - 21_500_000) < Math.abs(arr[best] - 21_500_000) ? i : best,
  0
);

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
        pre-computed grid. Coal collapses and grid deaths fall ~95%+ under{" "}
        <em>either</em> price — that&apos;s the robust result. Now look at{" "}
        <span style={{ color: "var(--series-gas)" }} className="font-medium">
          gas
        </span>
        : the carbon price pushes it far lower than the mortality price does. The
        two prices genuinely disagree about gas — carbon-heavy but comparatively
        low-mortality — and over the full horizon that disagreement reaches the{" "}
        <em>built mix</em>, not just the marginal cost ($347 vs $39/MWh). Move
        both sliders in the{" "}
        <a href="/playground" className="underline hover:text-accent">
          playground
        </a>
        .
      </figcaption>
    </figure>
  );
}
