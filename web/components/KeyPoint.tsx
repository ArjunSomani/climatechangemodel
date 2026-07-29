import type { ReactNode } from "react";

// Three pages had independently grown the same block: a rounded box with a 2px
// colored left stripe, holding either the page's thesis or a modeling caveat.
// The stripe was doing the work of "this sentence matters more than the ones
// around it" -- which is typography's job, not a decorative border's, and a
// heavy one-sided border is the tell that the hierarchy wasn't designed.
//
// Two tones, because the two rhetorical roles are genuinely different:
//
//   lede    The single most important sentence on the page. Earns emphasis
//           through size, measure, and a rule that spans the full column --
//           editorial, matching the Fraunces headings, no container at all.
//
//   caveat  A limitation the reader needs but shouldn't be stopped by. Reads
//           quieter than body copy: small, on a tinted surface, full hairline
//           border on all four sides.
//
// `label` is the inline lead-in ("In one line:", "The payoff:"). It carries the
// color, so the accent lands on words rather than on furniture.
export function KeyPoint({
  tone = "lede",
  accent = "mortality",
  label,
  children,
}: {
  tone?: "lede" | "caveat";
  accent?: "mortality" | "accent";
  label?: string;
  children: ReactNode;
}) {
  const labelColor =
    accent === "mortality" ? "text-[var(--mortality)]" : "text-accent";

  if (tone === "caveat") {
    return (
      <aside className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
        {label && (
          <span className={`font-medium ${labelColor}`}>{label} </span>
        )}
        {children}
      </aside>
    );
  }

  return (
    <aside className="mt-6 border-t border-zinc-300 pt-5 dark:border-zinc-700">
      <p className="max-w-[60ch] text-lg leading-relaxed text-zinc-800 text-pretty dark:text-zinc-200">
        {label && (
          <span className={`font-medium ${labelColor}`}>{label} </span>
        )}
        {children}
      </p>
    </aside>
  );
}
