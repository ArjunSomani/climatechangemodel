// A single-measure magnitude chart: annual grid deaths across pricing regimes.
// One measure (deaths), so one hue -- var(--mortality), the site's reserved
// mortality color -- with the value direct-labelled on every bar (no legend
// needed; the caption names the series). Bars grow from a shared zero baseline
// and share one scale, so the gap between regimes is read by length, honestly.
// Pure server component: no interactivity, just laid-out divs.

export interface DeathBarRow {
  label: string;
  sublabel?: string;
  deaths: number;
  // Optional short callout rendered next to the value (e.g. "fewest deaths").
  note?: string;
}

export function FindingsDeathBars({
  rows,
  max,
}: {
  rows: DeathBarRow[];
  max?: number;
}) {
  const scaleMax = max ?? Math.max(...rows.map((r) => r.deaths));

  return (
    <div
      role="img"
      aria-label={
        "Annual grid deaths by pricing regime: " +
        rows
          .map((r) => `${r.label} ${Math.round(r.deaths).toLocaleString()}`)
          .join(", ")
      }
    >
      <div className="space-y-3">
        {rows.map((r) => {
          // Floor the width so a tiny value is still a visible sliver, not a
          // vanished bar -- length still reads correctly against its neighbours.
          const pct = Math.max(1.5, (r.deaths / scaleMax) * 100);
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">
                  {r.label}
                  {r.sublabel ? (
                    <span className="ml-1.5 font-normal text-zinc-500 dark:text-zinc-400">
                      {r.sublabel}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums" style={{ color: "var(--mortality)" }}>
                  {Math.round(r.deaths).toLocaleString()}
                  {r.note ? (
                    <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      {r.note}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1 h-6 w-full">
                <div
                  className="h-full rounded-sm"
                  style={{ width: `${pct}%`, background: "var(--mortality)" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
