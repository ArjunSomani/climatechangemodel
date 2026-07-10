import Link from "next/link";
import { notFound } from "next/navigation";
import { getLibraryCase } from "@/lib/library";
import { EnergyMixChart } from "@/components/EnergyMixChart";
import { YearTable } from "@/components/YearTable";
import { SOURCES } from "@/lib/sources";
import { formatCO2, formatEnergy } from "@/lib/format";

// Reflects live Neon/Blob data -- must not be prerendered/cached at build time.
export const dynamic = "force-dynamic";

export default async function LibraryCasePage({
  params,
}: PageProps<"/library/[...caseId]">) {
  const { caseId } = await params;
  const detail = await getLibraryCase(caseId.join("/"));

  if (!detail) notFound();

  const lastYear = detail.result[detail.result.length - 1];
  const totalCO2MT = SOURCES.reduce(
    (sum, s) => sum + (lastYear[`${s.key}_CO2_MT`] ?? 0),
    0
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/library"
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Library
      </Link>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        {detail.group_name} — CO₂ price ${detail.co2_initial}/MT
      </h1>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        {detail.region} · {detail.years} years · {detail.co2_regime.replace("_", " ")}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Final-year CO₂" value={formatCO2(totalCO2MT)} />
        <Stat label="Final-year demand" value={formatEnergy(lastYear.Target_MWh)} />
        <Stat label="Final-year outage" value={formatEnergy(lastYear.Outage_MWh)} />
        <Stat label="Years modeled" value={String(detail.years)} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">
          Energy mix over time
        </h2>
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <EnergyMixChart data={detail.result} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">
          Year-by-year data
        </h2>
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <YearTable data={detail.result} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}
