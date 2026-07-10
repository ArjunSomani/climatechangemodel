"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LibraryCaseSummary } from "@/lib/library";
import { caseLabel } from "@/lib/metrics";

export function CasePicker({ cases }: { cases: LibraryCaseSummary[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const byGroup = new Map<string, LibraryCaseSummary[]>();
    for (const c of cases) {
      const key = `${c.group_name} / ${c.variant}`;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(c);
    }
    return byGroup;
  }, [cases]);

  function toggle(caseId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }

  function goCompare() {
    const query = encodeURIComponent(Array.from(selected).join(","));
    router.push(`/compare?cases=${query}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pick 2 or more cases to compare.
        </p>
        <button
          onClick={goCompare}
          disabled={selected.size < 2}
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-30 dark:bg-white dark:text-black"
        >
          Compare selected ({selected.size})
        </button>
      </div>

      <div className="mt-6 space-y-6">
        {Array.from(groups.entries()).map(([groupKey, groupCases]) => (
          <div key={groupKey}>
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {groupKey}
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {groupCases.map((c) => (
                <label
                  key={c.case_id}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.case_id)}
                    onChange={() => toggle(c.case_id)}
                  />
                  {caseLabel(c)}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
