// Operational water use for a scenario -- the reported (not priced) water axis.
// Two registers, kept distinct on purpose: withdrawal (taken, mostly returned
// warmer) and consumption (evaporated, gone), the same counted-vs-modeled care
// the deaths view uses. Plus the per-source ladder that makes the axis legible:
// nuclear withdraws the most, coal consumes among the most, solar and wind are
// dry -- so a carbon price (which favors nuclear) and water scarcity pull apart.
import {
  cumulativeWaterUse,
  waterIntensityGalPerMWh,
  waterLadder,
  WATER_META,
} from "@/lib/water";
import type { YearRecord } from "@/lib/library";

// Input is million gallons (Mgal). Scale up so a 25-year regional total reads as
// billions/trillions rather than a 7-digit Mgal figure.
function formatGallons(mgal: number): string {
  const abs = Math.abs(mgal);
  if (abs >= 1e6) return `${(mgal / 1e6).toFixed(1)} trillion gal`;
  if (abs >= 1e3) return `${(mgal / 1e3).toFixed(1)} billion gal`;
  return `${mgal.toFixed(0)} million gal`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 font-sans text-2xl font-medium tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</div>
    </div>
  );
}

export function WaterResults({ result }: { result: YearRecord[] }) {
  if (result.length === 0) return null;
  const last = result[result.length - 1];
  const cum = cumulativeWaterUse(result);
  const intensity = waterIntensityGalPerMWh(last);
  const ladder = waterLadder();
  const maxWithdrawal = Math.max(...ladder.map((r) => r.withdrawal), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat
          label="Water withdrawn (cumulative)"
          value={formatGallons(cum.withdrawalMgal)}
          sub={`${Math.round(intensity.withdrawal).toLocaleString()} gal/MWh in the final year — mostly returned, warmer`}
        />
        <Stat
          label="Water consumed (cumulative)"
          value={formatGallons(cum.consumptionMgal)}
          sub={`${Math.round(intensity.consumption).toLocaleString()} gal/MWh in the final year — evaporated, gone`}
        />
      </div>

      {/* Per-source ladder: withdrawal (full bar) with the consumed portion
          overlaid darker, so the taken-vs-gone split is visible per source. */}
      <div>
        <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Water per MWh, by source (gal/MWh)
        </div>
        <div className="mt-3 space-y-2">
          {ladder.map((r) => (
            <div key={r.key} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {r.label}
              </span>
              <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                {/* Withdrawal: full-width proportional, at low opacity. */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-40"
                  style={{
                    width: `${(r.withdrawal / maxWithdrawal) * 100}%`,
                    background: `var(${r.colorVar})`,
                  }}
                  aria-hidden
                />
                {/* Consumption: the evaporated portion, solid on top. */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${(r.consumption / maxWithdrawal) * 100}%`,
                    background: `var(${r.colorVar})`,
                  }}
                  aria-hidden
                />
              </div>
              <span className="w-28 shrink-0 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {r.withdrawal.toLocaleString()} / {r.consumption.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Faint bar = withdrawn, solid = consumed (gal/MWh). Nuclear withdraws the
          most; coal consumes among the most; solar and wind are essentially dry.
          A carbon price favors nuclear — water scarcity pushes the other way,
          which is the tension this axis exposes.
        </p>
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {WATER_META.citation} Figures are {WATER_META.coolingSystem} factors;
        they vary heavily by cooling system (once-through withdrawal is one to two
        orders of magnitude higher), so a single national number per technology
        papers over a real spread. Water is reported here, not priced into the
        optimization.
      </p>
    </div>
  );
}
