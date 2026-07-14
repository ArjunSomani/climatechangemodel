"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { EnergyMixChart } from "@/components/EnergyMixChart";
import { YearTable } from "@/components/YearTable";
import { useRunStatus } from "@/lib/useRunStatus";

function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);
  return elapsed;
}

export default function CustomRunStatusPage({
  params,
}: PageProps<"/custom-run/[id]">) {
  const { id } = use(params);
  const { status, errorMessage, result } = useRunStatus(id);
  const pending = status === "loading" || status === "queued" || status === "running";
  const elapsed = useElapsedSeconds(pending);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/custom-run"
        className="text-sm text-zinc-500 hover:text-accent dark:text-zinc-400"
      >
        ← New custom run
      </Link>

      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Custom run</h1>

      {pending && (
        <div className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent"
            />
            <p className="text-zinc-600 dark:text-zinc-400">
              {status === "queued"
                ? "Queued — waiting for a worker to pick this up…"
                : "Running the scenario through the engine — this typically takes about a minute…"}
            </p>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="animate-indeterminate h-full w-1/3 rounded-full bg-accent" />
          </div>
          {elapsed > 0 && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {elapsed}s elapsed
            </p>
          )}
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
