import { riskLadder, levelSourceUrl, HOMES_PER_TWH } from "@/lib/mortality";

// The signature chart: every generating source ranked by deaths per TWh on a
// log scale, coal at the top, solar at the bottom -- the whole thesis in one
// look. Built as semantic HTML bars (not a chart lib) so the log scale, the
// counted/modeled texture split, and the screen-reader values are all exact
// and under our control. Bar color is the source's own identity color, the
// same one it wears in every energy-mix chart.

// The counted/modeled texture. Uses the theme-aware --hatch token rather than a
// literal rgba(0,0,0,.28): a fixed black hatch is tuned for the light theme's
// darker bar colors and goes nearly invisible over the dark theme's lighter
// ones, so the split it encodes disappeared in exactly one of the two themes.
const HATCH =
  "repeating-linear-gradient(45deg, var(--hatch) 0 2px, transparent 2px 5px)";

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
        // The uncertainty band and the counted/modeled split were only ever in
        // `title` attributes, which never reach keyboard or touch users and are
        // inconsistently surfaced by screen readers. They're part of the
        // chart's meaning, so they belong in its text alternative.
        aria-label={
          "Deaths per terawatt-hour by electricity source, on a log scale, " +
          "ranked from deadliest. " +
          rows
            .map(
              (r) =>
                `${r.label}: ${fmtRate(r.central)} deaths per terawatt-hour` +
                (r.high > r.central
                  ? `, range ${fmtRate(r.low)} to ${fmtRate(r.high)}`
                  : "") +
                `, ${Math.round((1 - r.modeledShare) * 100)}% counted accidents and ` +
                `${Math.round(r.modeledShare * 100)}% modeled pollution`
            )
            .join(". ") +
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
                    className="rounded bg-zinc-200 px-1 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
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
                      backgroundImage: HATCH,
                    }}
                    aria-hidden
                  />
                </div>
              </div>

              <div className="w-28 shrink-0 text-right text-sm tabular-nums sm:w-36">
                <div>
                  <span className="font-medium">{fmtRate(r.central)}</span>
                  <span className="text-zinc-500 dark:text-zinc-400"> /TWh</span>
                  {/* Eight links reading "src" told a screen-reader user
                      running through the link list nothing at all (SC 2.4.4).
                      The visible text stays compact; the accessible name says
                      which source and which row it belongs to. */}
                  <a
                    href={levelSourceUrl(r.source)}
                    aria-label={`Source for ${r.label}: ${r.source} (opens in a new tab)`}
                    className="ml-1 inline-flex min-h-6 min-w-6 items-center justify-center text-xs text-zinc-500 underline hover:text-accent dark:text-zinc-400"
                    target="_blank"
                    rel="noreferrer"
                  >
                    src
                  </a>
                </div>
                {r.high > r.central && (
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    up to {fmtRate(r.high)} (high)
                  </div>
                )}
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
            style={{ backgroundImage: HATCH }}
          />
          modeled (pollution/radiation)
        </span>
        <span>
          1 TWh ≈ powering {Math.round(HOMES_PER_TWH / 1000)}k homes for a year
        </span>
        <span>
          <span className="rounded bg-zinc-200 px-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">n/a</span> = not
          among Optimize&apos;s optimized technologies (rides along with demand)
          — still carries a real death toll, counted in the Data Explorer&apos;s
          read of the actual grid, but never in an optimized scenario&apos;s mix
        </span>
      </figcaption>
    </figure>
  );
}
