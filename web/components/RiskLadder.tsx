import { riskLadder, levelSourceUrl, HOMES_PER_TWH } from "@/lib/mortality";

// The signature chart: every generating source ranked by deaths per TWh on a
// log scale, coal at the top, solar at the bottom -- the whole thesis in one
// look. Built as semantic HTML bars (not a chart lib) so the log scale, the
// counted/modeled texture split, and the screen-reader values are all exact
// and under our control. Bar color is the source's own identity color, the
// same one it wears in every energy-mix chart.

function logWidthPct(value: number, min: number, max: number): number {
  // Position on a log axis, floored so the smallest bars stay visible.
  const t = (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return Math.max(3, t * 100);
}

function fmtRate(v: number): string {
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return v.toString();
}

export function RiskLadder() {
  const rows = riskLadder();
  const min = Math.min(...rows.map((r) => r.central));
  const max = Math.max(...rows.map((r) => r.central));

  return (
    <figure className="my-0">
      <div
        role="img"
        aria-label={
          "Deaths per terawatt-hour by electricity source, on a log scale, ranked from " +
          rows
            .map((r) => `${r.label} ${fmtRate(r.central)}`)
            .join(", ") +
          ". Coal is the deadliest, solar the safest."
        }
        className="space-y-2.5"
      >
        {rows.map((r) => {
          const barPct = logWidthPct(r.central, min, max);
          const countedPct = Math.round((1 - r.modeledShare) * 100);
          const color = `var(${r.colorVar})`;
          return (
            <div key={r.key} className="flex items-center gap-3">
              <div className="flex w-24 shrink-0 items-center gap-1.5 sm:w-28">
                <span className="text-sm font-medium">{r.label}</span>
                {!r.dispatched && (
                  <span
                    title="Not built by Optimize's optimizer; rides along with demand in reality."
                    className="rounded bg-zinc-200 px-1 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    n/a
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="flex h-5 overflow-hidden rounded-sm"
                  style={{ width: `${barPct}%` }}
                  title={`${r.label}: ${fmtRate(r.central)} deaths/TWh (band ${fmtRate(
                    r.low
                  )}–${fmtRate(r.high)}). ${countedPct}% counted, ${100 - countedPct}% modeled.`}
                >
                  {/* Counted (solid) */}
                  <div
                    style={{ width: `${countedPct}%`, background: color }}
                    aria-hidden
                  />
                  {/* Modeled (hatched) */}
                  <div
                    style={{
                      width: `${100 - countedPct}%`,
                      backgroundColor: color,
                      backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 5px)`,
                    }}
                    aria-hidden
                  />
                </div>
              </div>

              <div className="w-28 shrink-0 text-right text-sm tabular-nums sm:w-32">
                <span className="font-medium">{fmtRate(r.central)}</span>
                <span className="text-zinc-400"> /TWh</span>
                <a
                  href={levelSourceUrl(r.source)}
                  className="ml-2 text-xs text-zinc-400 underline hover:text-accent"
                  target="_blank"
                  rel="noreferrer"
                >
                  src
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span>Deaths per TWh · log scale</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-zinc-400" />
          counted (accidents)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-sm bg-zinc-400"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 5px)",
            }}
          />
          modeled (pollution/radiation)
        </span>
        <span>
          1 TWh ≈ powering {Math.round(HOMES_PER_TWH / 1000)}k homes for a year
        </span>
      </figcaption>
    </figure>
  );
}
