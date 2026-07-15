"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { EnergyMixChart } from "@/components/EnergyMixChart";
import { YearTable } from "@/components/YearTable";
import { RunDownload } from "@/components/RunDownload";
import { useRunStatus } from "@/lib/useRunStatus";

// The queue worker runs on a wall-clock cron (`*/5 * * * *` in
// run_worker.yml), so it fires at :00, :05, :10 … -- not five minutes after
// you submit. Point at the next such mark. Every standard UTC offset is a
// multiple of 5 minutes, so the viewer's local 5-minute marks line up with
// the cron's. GitHub can still run a scheduled job late under load, so treat
// this as "no earlier than", not a guarantee.
function nextQueueCheck(): string {
  const next = new Date();
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + (5 - (next.getMinutes() % 5)));
  return next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

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
  const { status, errorMessage, config, result } = useRunStatus(id);
  const pending = status === "loading" || status === "queued" || status === "running";
  const elapsed = useElapsedSeconds(pending);

  // Two very different waits: a worker drains the queue on a wall-clock
  // 5-minute cron (engine/scripts/run_worker.py via run_worker.yml), then the
  // engine itself computes a single scenario in roughly a minute. Estimate the
  // phase the run is actually in so the number next to "elapsed" isn't
  // misleading -- while queued, point at the next real 5-minute mark.
  const estimateText =
    status === "queued"
      ? `The queue is checked every 5 minutes on the clock, so the next check is around ${nextQueueCheck()} — GitHub sometimes runs it a little late.`
      : "This usually finishes in about a minute.";

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
                : "Running the scenario through the engine…"}
            </p>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="animate-indeterminate h-full w-1/3 rounded-full bg-accent" />
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {elapsed > 0 && (
              <span className="tabular-nums">{elapsed}s elapsed · </span>
            )}
            {estimateText}
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
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Save this run:
            </span>
            <RunDownload runId={id} config={config} result={result} />
          </div>

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
