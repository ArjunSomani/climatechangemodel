import type { ReactNode } from "react";

// Recharts colors each legend *label* with its series color, overriding whatever
// you set on the Legend's wrapperStyle. That put real 13px text at the series
// hue -- and a fill tuned for 3:1 (the right bar for a graphical object) is not
// a legible text color. Measured on the light surface before this: nuclear
// 2.11:1, wind 2.74:1, battery 3.85:1, solar 4.30:1, and gas 3.90:1 on dark.
//
// The swatch already carries the color. The label's job is to be readable, so it
// takes --ink-secondary (7.73:1 light, 10.76:1 dark) in both themes. This is
// also just better dataviz: color-on-color legend text is redundant encoding
// that costs legibility and buys nothing.
//
// Pass as `formatter={legendLabel}` on every <Legend>.
export function legendLabel(value: ReactNode) {
  return <span style={{ color: "var(--ink-secondary)" }}>{value}</span>;
}
