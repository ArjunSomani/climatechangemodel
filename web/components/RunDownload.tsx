"use client";

import type { YearRecord } from "@/lib/library";
import type { ScenarioConfigInput } from "@/lib/scenarioConfig";

// Full year-by-year records as CSV -- raw engine values at full precision
// (MWh, M$, MT), not the on-screen rounded/formatted numbers, so the export
// is analysis-ready. "Year" is forced first; the rest follow the engine's
// own column order from the first record.
function toCsv(rows: YearRecord[]): string {
  if (rows.length === 0) return "";
  const rest = Object.keys(rows[0]).filter((k) => k !== "Year");
  const cols = ["Year", ...rest];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.map(esc).join(","),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\n");
}

function triggerDownload(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
    </svg>
  );
}

const buttonClass =
  "inline-flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-accent hover:text-accent dark:border-zinc-700 dark:text-zinc-300";

export function RunDownload({
  runId,
  config,
  result,
}: {
  runId: string;
  config: ScenarioConfigInput | null;
  result: YearRecord[];
}) {
  const base = `custom-run-${config?.region ?? "scenario"}-${runId.slice(0, 8)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => triggerDownload(`${base}.csv`, toCsv(result), "text/csv")}
        className={buttonClass}
      >
        <DownloadIcon />
        Download CSV
      </button>
      <button
        type="button"
        onClick={() =>
          triggerDownload(
            `${base}.json`,
            // Bundle the scenario config with the results so the download is
            // self-describing and the exact run can be reproduced later.
            JSON.stringify({ config, result }, null, 2),
            "application/json"
          )
        }
        className={buttonClass}
      >
        <DownloadIcon />
        Download JSON
      </button>
    </div>
  );
}
