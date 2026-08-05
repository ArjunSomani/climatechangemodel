import Link from "next/link";
import { notFound } from "next/navigation";
import { getLibraryCase } from "@/lib/library";
import { ResultCharts } from "@/components/ResultCharts";
import { YearTable } from "@/components/YearTable";
import { MortalityResults } from "@/components/MortalityResults";
import { ScenarioStats } from "@/components/ScenarioStats";
import { BuildLimits } from "@/components/BuildLimits";
import { WaterResults } from "@/components/WaterResults";

// Reflects live Neon/Blob data -- must not be prerendered/cached at build time.
export const dynamic = "force-dynamic";

export default async function LibraryCasePage({
  params,
}: PageProps<"/library/[...caseId]">) {
  const { caseId } = await params;
  const detail = await getLibraryCase(caseId.join("/"));

  if (!detail) notFound();

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

      <div className="mt-8">
        <ScenarioStats result={detail.result} />
      </div>

      <Section title="Generation, capacity & cost over time">
        <ResultCharts data={detail.result} mortalityPrice={mortalityInitial} />
      </Section>

      <Section title="Mortality">
        <MortalityResults result={detail.result} config={null} />
      </Section>

      <Section title="Water use">
        <WaterResults result={detail.result} />
      </Section>

      <Section title="Where build-rate caps bind">
        <BuildLimits records={detail.result} />
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
