// A diagnostic, not a description: for each source, which years it was pinned
// against its build-rate cap -- using ~100% of the maximum capacity it was
// allowed to add that year ({s}_PCT_Max_Add ~ 1, see lib/metrics.ts).
//
// This is what explains the site's null result. When a build-rate cap binds
// under both a carbon-only and a mortality-only price, the two give the same mix
// no matter how differently the economics would push -- so a reader can see the
// cause of the identical answers rather than take it on assertion.
import { buildLimitSummary } from "@/lib/metrics";
import { SOURCES } from "@/lib/sources";
import type { YearRecord } from "@/lib/library";

const LABEL = Object.fromEntries(SOURCES.map((s) => [s.key, s.label]));
const COLOR = Object.fromEntries(SOURCES.map((s) => [s.key, s.color]));

export function BuildLimits({ records }: { records: YearRecord[] }) {
  const summary = buildLimitSummary(records);
  const years = records.map((r) => Number(r.Year));

  if (summary.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No source hit its build-rate cap in this scenario — every year&rsquo;s
        mix was set by economics, not by how fast capacity is allowed to grow.
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {summary.map((row) => {
          const limited = new Set(row.years);
          return (
            <div key={row.source} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {LABEL[row.source]}
              </span>
              <div
                className="flex flex-1 gap-px"
                role="img"
                aria-label={`${LABEL[row.source]} at its build-rate cap in ${
                  row.years.length
                } of ${years.length} years: ${row.years.join(", ")}`}
              >
                {years.map((y) => {
                  const on = limited.has(y);
                  return (
                    <div
                      key={y}
                      className={
                        "h-3 flex-1 rounded-[1px] " +
                        (on ? "" : "bg-zinc-100 dark:bg-zinc-800")
                      }
                      style={on ? { background: COLOR[row.source] } : undefined}
                      title={`${y}: ${on ? "at build-rate cap" : "below the cap"}`}
                    />
                  );
                })}
              </div>
              <span className="w-10 shrink-0 text-right text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                {row.years.length}y
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        Filled = the source was pinned against its build-rate cap that year (used
        ~all of the capacity it was allowed to add). A source stuck at its cap is
        being held back by how fast it can be built, not by price — so a carbon
        and a mortality price that both pin the same source arrive at the same
        mix. Years {years[0]}–{years[years.length - 1]}, left to right.
      </p>
    </div>
  );
}
