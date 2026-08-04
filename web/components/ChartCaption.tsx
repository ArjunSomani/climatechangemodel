import type { ReactNode } from "react";

// The label above a chart or data panel. Eight of these had grown independently
// as `text-xs font-medium tracking-wide uppercase` -- the hero eyebrow's styling
// one tier down, applied to things that are not eyebrows but whole clauses
// ("Coal exits under either price — but gas is where they diverge"). All-caps
// destroys word shape, which is exactly what a reader relies on most at 12px, so
// the trope was also costing legibility on the longest strings.
//
// Sentence case, same size and color, no tracking. Short unit and column labels
// elsewhere ("deaths / yr", table <th>s) stay small-caps: that's a data-table
// convention on two-or-three-word strings, not scaffolding.
export function ChartCaption({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "text-xs font-medium text-zinc-600 dark:text-zinc-400 " + className
      }
    >
      {children}
    </div>
  );
}
