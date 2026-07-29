import Link from "next/link";
import { getLibraryCases, listLibraryCases } from "@/lib/library";
import { caseLabel, totalCO2MT } from "@/lib/metrics";
import { computeYearDeaths } from "@/lib/mortality";
import { UncertaintyBandNote } from "@/components/SafetyDisclosure";
import { CasePicker } from "@/components/CasePicker";
import { CO2TrajectoryChart } from "@/components/CO2TrajectoryChart";
import { CO2VsDeathsChart } from "@/components/CO2VsDeathsChart";
import { EnergyMixChart } from "@/components/EnergyMixChart";
import { CapacityChart } from "@/components/CapacityChart";
import { formatEnergy } from "@/lib/format";
import { Term } from "@/components/Term";
import { NewHereBanner } from "@/components/NewHereBanner";
import { AssumptionsBadges } from "@/components/AssumptionsBadges";

export const metadata = {
  title: "Compare — Optimize",
};

// Reflects live Neon/Blob data -- must not be prerendered/cached at build time.
export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: PageProps<"/compare">) {
  const params = await searchParams;
  const casesParam = typeof params.cases === "string" ? params.cases : "";
  const caseIds = casesParam.split(",").filter(Boolean);

  if (caseIds.length < 2) {
    const allCases = await listLibraryCases();
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Compare scenarios</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {caseIds.length === 1
            ? "Pick at least one more case to compare."
            : "Select cases from the library to compare their outcomes side by side."}
        </p>
        <div className="mt-6">
          <NewHereBanner />
        </div>
        <Link
          href={
            "/compare?cases=" +
            "mortality/carbon_only/constant_co2/co2_350_0/MIDW," +
            "mortality/central_vsl/constant_co2/co2_0_0/MIDW"
          }
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-accent/50 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/5"
        >
          See the example: carbon vs. mortality in the coal-heavy Midwest →
        </Link>
        <div className="mt-8">
          <CasePicker cases={allCases} />
        </div>
      </div>
    );
  }

  const cases = await getLibraryCases(caseIds);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/compare" className="text-sm text-zinc-500 hover:text-accent dark:text-zinc-400">
        ← Pick different cases
      </Link>

      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Comparing {cases.length} scenarios
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Numbers below are all from the last simulated year. Tap or hover a
        column header for what it means.
      </p>
      <div className="mt-4">
        <AssumptionsBadges />
      </div>

      <p className="mt-8 text-xs text-zinc-500 dark:text-zinc-400 sm:hidden">
        Scroll the table sideways to see every column →
      </p>
      <section className="mt-2 overflow-x-auto sm:mt-8">
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                Scenario
              </th>
              <th className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                <Term definition="Total carbon dioxide emitted by the grid in the final year, in metric tons (MT).">
                  CO₂ emitted
                </Term>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                <Term definition="Total electricity the region needed in the final year, in megawatt-hours (MWh).">
                  Electricity used
                </Term>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                <Term definition="Demand that went unmet in the final year, after every source and the battery were tapped. Ideally zero.">
                  Unmet demand (outage)
                </Term>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                <Term definition="Production-based deaths in the final year (central estimate), attributed to this region's generation mix — mostly modeled air-pollution deaths, some counted accidents. Coefficients from Level.">
                  Deaths (final year)
                </Term>
              </th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const last = c.result[c.result.length - 1];
              return (
                <tr key={c.case_id} className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="whitespace-nowrap px-3 py-2 text-black dark:text-zinc-50">
                    {caseLabel(c)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-black dark:text-zinc-50">
                    {totalCO2MT(last).toFixed(1)} MT
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-black dark:text-zinc-50">
                    {formatEnergy(last.Target_MWh)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-black dark:text-zinc-50">
                    {formatEnergy(last.Outage_MWh)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-black dark:text-zinc-50">
                    {Math.round(computeYearDeaths(last).central).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <span className="h-3 w-1 rounded-full bg-accent" aria-hidden />
          CO₂ emissions over time
        </h2>
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <CO2TrajectoryChart cases={cases} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <span className="h-3 w-1 rounded-full bg-accent" aria-hidden />
          Carbon vs. mortality
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Each scenario placed by its final-year CO₂ and its final-year deaths.
          Down-and-left is better on both; the spread shows where the two
          externalities pull apart.
        </p>
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <CO2VsDeathsChart cases={cases} />
        </div>
        <div className="mt-3">
          <UncertaintyBandNote />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <span className="h-3 w-1 rounded-full bg-accent" aria-hidden />
          Energy mix per scenario
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {cases.map((c) => (
            <div key={c.case_id}>
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                {caseLabel(c)}
              </p>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <EnergyMixChart data={c.result} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <span className="h-3 w-1 rounded-full bg-accent" aria-hidden />
          Installed capacity per scenario
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          What gets <em>built</em> (MW), as opposed to what runs (MWh above) —
          the two diverge where a source is built but dispatched less.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {cases.map((c) => (
            <div key={c.case_id}>
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                {caseLabel(c)}
              </p>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <CapacityChart data={c.result} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
