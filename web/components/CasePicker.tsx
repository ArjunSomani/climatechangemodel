"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LibraryCaseSummary } from "@/lib/library";
import { caseLabel } from "@/lib/metrics";
import { ScenarioPicker } from "@/components/ScenarioPicker";

export function CasePicker({ cases }: { cases: LibraryCaseSummary[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState<LibraryCaseSummary | null>(null);
  const [added, setAdded] = useState<LibraryCaseSummary[]>([]);

  function addCurrent() {
    if (!current) return;
    setAdded((prev) =>
      prev.some((c) => c.case_id === current.case_id) ? prev : [...prev, current]
    );
  }

  function remove(caseId: string) {
    setAdded((prev) => prev.filter((c) => c.case_id !== caseId));
  }

  function goCompare() {
    const query = encodeURIComponent(added.map((c) => c.case_id).join(","));
    router.push(`/compare?cases=${query}`);
  }

  const alreadyAdded = current && added.some((c) => c.case_id === current.case_id);

  return (
    <div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Configure a scenario, add it to the comparison, and repeat for
        anything else you want to compare.
      </p>

      <div className="mt-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <ScenarioPicker cases={cases} onChange={setCurrent} />
        <button
          onClick={addCurrent}
          disabled={!current || !!alreadyAdded}
          className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground disabled:opacity-30"
        >
          {alreadyAdded ? "Already added" : "Add to comparison"}
        </button>
      </div>

      {added.length > 0 && (
        <div className="sticky bottom-0 -mx-6 mt-6 border-t border-zinc-200 bg-white/95 px-6 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
          <div className="mx-auto max-w-4xl py-4">
            <div className="flex flex-wrap gap-2">
              {added.map((c) => (
                <span
                  key={c.case_id}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 py-1 pr-1 pl-3 text-sm dark:border-zinc-700"
                >
                  {caseLabel(c)}
                  <button
                    onClick={() => remove(c.case_id)}
                    aria-label={`Remove ${caseLabel(c)}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {added.length} selected
              </span>
              <button
                onClick={goCompare}
                disabled={added.length < 2}
                className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-30 dark:bg-white dark:text-black"
              >
                Compare selected ({added.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
