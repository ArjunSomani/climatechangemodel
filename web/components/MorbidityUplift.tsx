"use client";

// Deaths are the only health harm Optimize prices. Morbidity -- asthma attacks,
// hospitalizations, lost workdays -- is far larger in count and is left out, so
// the health burden shown is a floor. This makes that explicit and adjustable
// rather than a footnote: pick an uplift and see what the monetized health cost
// would become. Default off, because the model prices none of it.
//
// The multiplier is deliberately the user's to set. EPA's PM2.5 benefit-per-ton
// methodology monetizes morbidity as a modest share on top of mortality, but the
// exact fraction depends on which endpoints are counted and is genuinely
// uncertain -- so this is framed as illustrative, the same posture the site takes
// toward VSL.
import { useState } from "react";

const PRESETS = [
  { label: "Off", pct: 0 },
  { label: "+5%", pct: 5 },
  { label: "+10%", pct: 10 },
  { label: "+20%", pct: 20 },
];

export function MorbidityUplift() {
  const [pct, setPct] = useState(0);
  const factor = 1 + pct / 100;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div
        role="group"
        aria-label="Morbidity uplift"
        className="inline-flex flex-wrap gap-0.5 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
      >
        {PRESETS.map((p) => {
          const selected = p.pct === pct;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={selected}
              onClick={() => setPct(p.pct)}
              className={
                "min-h-9 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors " +
                (selected
                  ? "bg-accent text-accent-foreground"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50")
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-zinc-700 dark:text-zinc-300" role="status" aria-live="polite">
        {pct === 0 ? (
          <>
            The model prices <span className="font-medium">deaths only</span>. Turn
            on an uplift to see morbidity — the illnesses that don&apos;t kill —
            added to the monetized health burden.
          </>
        ) : (
          <>
            At <span className="font-medium">+{pct}%</span>, the monetized health
            burden this site reports would be{" "}
            <span className="font-medium tabular-nums" style={{ color: "var(--mortality)" }}>
              {factor.toFixed(2)}×
            </span>{" "}
            higher. Optimize prices none of it, so every health figure here is a{" "}
            <span className="font-medium">floor</span>, not an estimate of the full
            burden.
          </>
        )}
      </p>

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Illustrative. EPA&apos;s PM2.5 benefit-per-ton methodology monetizes
        morbidity as a share on top of mortality; the exact fraction depends on
        which endpoints are counted and is uncertain — which is why it&apos;s
        yours to set, and why the default is off.
      </p>
    </div>
  );
}
