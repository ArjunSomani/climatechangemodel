// The land-use footprint of solar and wind, with the total-vs-occupied split
// that a single land number hides. The visual point: by total enclosed area wind
// looks far worse than solar, but by land actually occupied it is far better --
// because a wind farm's turbines occupy only a sliver of the area they span.
import { LAND, overstatementFactor } from "@/lib/land";

function fmt(n: number): string {
  return n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString();
}

export function LandFootprint() {
  const max = Math.max(...LAND.map((r) => r.total), 1);

  return (
    <div>
      <div className="space-y-4">
        {LAND.map((r) => {
          const factor = overstatementFactor(r);
          return (
            <div key={r.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{r.label}</span>
                <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  {fmt(r.total)} total · {fmt(r.exclusive)} occupied km²/TWh
                </span>
              </div>
              <div className="relative mt-1 h-4 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                {/* Total enclosed area: faint, full proportional width. */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-30"
                  style={{ width: `${(r.total / max) * 100}%`, background: `var(${r.colorVar})` }}
                  aria-hidden
                />
                {/* Land actually occupied: solid on top. */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.max((r.exclusive / max) * 100, 0.6)}%`,
                    background: `var(${r.colorVar})`,
                  }}
                  aria-hidden
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Reporting only the total area overstates {r.label.toLowerCase()}
                &rsquo;s footprint by{" "}
                <span className="font-medium tabular-nums">
                  {factor >= 10 ? `${Math.round(factor)}×` : `${factor.toFixed(1)}×`}
                </span>
                . {r.note} <span className="italic">({r.source})</span>
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        Faint bar = total area enclosed, solid = land actually occupied (km² per
        TWh/yr). By total area wind spans far more than solar; by land it actually
        uses, it needs far less — the gap is turbine spacing, which stays farm or
        rangeland. Thermal plants (coal, gas, nuclear) are left out: their on-site
        footprint is small but their land use is dominated by off-site mining and
        drilling, which has no single defensible per-MWh figure.
      </p>
    </div>
  );
}
