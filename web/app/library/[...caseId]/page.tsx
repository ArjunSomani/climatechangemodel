import Link from "next/link";
import { notFound } from "next/navigation";
import { getLibraryCase } from "@/lib/library";
import { ResultCharts } from "@/components/ResultCharts";
import { YearTable } from "@/components/YearTable";
import { MortalityResults } from "@/components/MortalityResults";
import { co2MtFromGeneration } from "@/lib/co2";
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
  const totalCO2 = co2MtFromGeneration(lastYear);
  const variantPart =
    detail.variant !== "Default" ? ` ${detail.variant.replace(/_/g, " ")}` : "";

  // Mortality price lives in the stored config, not a catalog column.
  const cfg = detail.config as
    | { mortality_price?: { initial?: number } }
    | null;
  const mortalityInitial = cfg?.mortality_price?.initial ?? 0;
  const priceLabel =
    mortalityInitial > 0
      ? `CO₂ $${detail.co2_initial}/MT · mortality $${(mortalityInitial / 1_000_000).toFixed(1)}M/death`
      : `CO₂ price $${detail.co2_initial}/MT`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/library"
        className="text-sm text-zinc-500 hover:text-accent dark:text-zinc-400"
      >
        ← Library
      </Link>

      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {detail.group_name.replace(/_/g, " ")}
        {variantPart} — {priceLabel}
      </h1>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        {detail.region} · {detail.years} years · {detail.co2_regime.replace("_", " ")}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Final-year CO₂" value={formatCO2(totalCO2)} />
        <Stat label="Final-year demand" value={formatEnergy(lastYear.Target_MWh)} />
        <Stat label="Final-year outage" value={formatEnergy(lastYear.Outage_MWh)} />
        <Stat label="Years modeled" value={String(detail.years)} />
      </div>

      <Section title="Generation, capacity & cost over time">
        <ResultCharts data={detail.result} mortalityPrice={mortalityInitial} />
      </Section>

      <Section title="Mortality">
        <MortalityResults result={detail.result} config={null} />
      </Section>

      <Section title="Year-by-year data">
        <YearTable data={detail.result} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <span className="h-3 w-1 rounded-full bg-accent" aria-hidden />
        {title}
      </h2>
      <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        {children}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="font-display mt-1 text-2xl font-medium">{value}</div>
    </div>
  );
}
