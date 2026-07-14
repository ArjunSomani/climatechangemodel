"use client";

import { useState } from "react";
import Link from "next/link";
import type { LibraryCaseSummary } from "@/lib/library";
import { ScenarioPicker } from "@/components/ScenarioPicker";

export function LibraryPickerClient({ cases }: { cases: LibraryCaseSummary[] }) {
  const [selected, setSelected] = useState<LibraryCaseSummary | null>(null);

  return (
    <div>
      <ScenarioPicker cases={cases} onChange={setSelected} />

      {selected && (
        <div className="mt-6 flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {selected.region} · {selected.years} years ·{" "}
              {selected.co2_regime.replace("_", " ")}
            </div>
            <div className="font-display mt-1 text-lg font-medium">
              {selected.group_name.replace(/_/g, " ")}
              {selected.variant !== "Default" && ` ${selected.variant.replace(/_/g, " ")}`}
              {" — "}
              {selected.co2_regime === "Increasing_CO2"
                ? `+$${selected.co2_initial}/yr to $${selected.co2_yearly}/MT`
                : `$${selected.co2_initial}/MT`}
            </div>
          </div>
          <Link
            href={`/library/${selected.case_id}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            View results →
          </Link>
        </div>
      )}
    </div>
  );
}
