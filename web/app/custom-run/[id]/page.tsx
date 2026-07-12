"use client";

import { use } from "react";
import Link from "next/link";
import { EnergyMixChart } from "@/components/EnergyMixChart";
import { YearTable } from "@/components/YearTable";
import { useRunStatus } from "@/lib/useRunStatus";

export default function CustomRunStatusPage({
  params,
}: PageProps<"/custom-run/[id]">) {
  const { id } = use(params);
  const { status, errorMessage, result } = useRunStatus(id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/custom-run"
        className="text-sm text-zinc-500 hover:text-accent dark:text-zinc-400"
      >
        ← New custom run
      </Link>

      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Custom run</h1>

      {(status === "loading" || status === "queued" || status === "running") && (
        <div className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <p className="text-zinc-600 dark:text-zinc-400">
            {status === "queued"
              ? "Queued — waiting for a worker to pick this up…"
              : "Running the scenario through the engine — this typically takes about a minute…"}
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="mt-8 rounded-lg border border-red-300 p-6 dark:border-red-800">
          <p className="font-medium text-red-600 dark:text-red-400">Run failed</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {errorMessage ?? "Unknown error"}
          </p>
        </div>
      )}

      {status === "done" && result && (
        <>
          <Section title="Energy mix over time">
            <EnergyMixChart data={result} />
          </Section>

          <Section title="Year-by-year data">
            <YearTable data={result} />
          </Section>
        </>
      )}
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
