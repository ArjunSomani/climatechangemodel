import Link from "next/link";
import { getLibraryCases, listLibraryCases } from "@/lib/library";
import { caseLabel, totalCO2MT } from "@/lib/metrics";
import { CasePicker } from "@/components/CasePicker";
import { CO2TrajectoryChart } from "@/components/CO2TrajectoryChart";
import { EnergyMixChart } from "@/components/EnergyMixChart";
import { formatEnergy } from "@/lib/format";

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

      <section className="mt-8 overflow-x-auto">
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                Scenario
              </th>
              <th className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                Final-year CO₂
              </th>
              <th className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                Final-year demand
              </th>
              <th className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                Final-year outage
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
    </div>
  );
}
