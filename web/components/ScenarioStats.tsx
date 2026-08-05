// Headline numbers for a scenario, in three explicitly-labeled registers:
//
//   Final year        -- the endpoint absolutes (demand, CO2, deaths)
//   Intensity         -- those normalized per unit of energy, so a scenario is
//                        comparable across regions and against outside references
//                        (gCO2/kWh vs grid average, deaths/TWh vs the risk ladder,
//                        $/MWh vs Lazard)
//   Cumulative        -- the whole-horizon totals, because the path matters, not
//                        just the 2050 endpoint (and cumulative CO2, not the final
//                        rate, is what drives warming)
//
// The register labels are the point: mislabeling a cumulative total as a final-
// year figure is exactly the class of bug that shipped once. Each group says
// which it is, with the year (range) spelled out.
import {
  carbonIntensityGPerKwh,
  cumulativeTotals,
  deathsPerTWh,
  lcoePerMWh,
  totalCO2MT,
} from "@/lib/metrics";
import { computeYearDeaths } from "@/lib/mortality";
import { formatCO2, formatEnergy } from "@/lib/format";
import type { YearRecord } from "@/lib/library";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 font-sans text-2xl font-medium tabular-nums">{value}</div>
      {sub ? (
        <div className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{sub}</div>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {title}
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </div>
  );
}

export function ScenarioStats({
  result,
}: {
  result: YearRecord[];
}) {
  if (result.length === 0) return null;
  const first = result[0];
  const last = result[result.length - 1];
  const firstYear = Number(first.Year);
  const lastYear = Number(last.Year);

  const deaths = computeYearDeaths(last).central;
  const cum = cumulativeTotals(result);

  return (
    <div className="space-y-6">
      <Group title={`Final year (${lastYear})`}>
        <Stat label="Demand" value={formatEnergy(last.Target_MWh)} />
        <Stat label="CO₂ emitted" value={formatCO2(totalCO2MT(last))} sub="this year" />
        <Stat label="Grid deaths" value={Math.round(deaths).toLocaleString()} sub="this year" />
      </Group>

      <Group title={`Intensity (${lastYear}) — comparable across regions`}>
        <Stat
          label="Carbon intensity"
          value={`${Math.round(carbonIntensityGPerKwh(last)).toLocaleString()} gCO₂/kWh`}
          sub="vs coal ~900, gas ~400"
        />
        <Stat
          label="Mortality intensity"
          value={`${deathsPerTWh(last).toFixed(1)} /TWh`}
          sub="deaths per TWh generated"
        />
        <Stat
          label="System cost"
          value={`$${Math.round(lcoePerMWh(last)).toLocaleString()}/MWh`}
          sub="busbar LCOE (excl. carbon/mortality price)"
        />
      </Group>

      <Group title={`Cumulative (${firstYear}–${lastYear}) — the whole path`}>
        <Stat
          label="CO₂ emitted"
          value={formatCO2(cum.co2Mt)}
          sub="total over the horizon"
        />
        <Stat
          label="Grid deaths"
          value={Math.round(cum.deathsCentral).toLocaleString()}
          sub="total over the horizon"
        />
      </Group>
    </div>
  );
}
