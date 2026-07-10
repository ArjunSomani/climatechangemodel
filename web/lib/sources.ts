// Fixed categorical order -- validated for CVD-safe adjacency as a
// contiguous run (slots 1-6) via the dataviz skill's validate_palette.js.
// Do not reorder or skip slots; see globals.css for the actual hex values
// per mode (light/dark), referenced here only by CSS variable name.
export const SOURCES = [
  { key: "Solar", label: "Solar", color: "var(--series-solar)" },
  { key: "Wind", label: "Wind", color: "var(--series-wind)" },
  { key: "Nuclear", label: "Nuclear", color: "var(--series-nuclear)" },
  { key: "Gas", label: "Gas", color: "var(--series-gas)" },
  { key: "Coal", label: "Coal", color: "var(--series-coal)" },
  { key: "Battery", label: "Battery", color: "var(--series-battery)" },
] as const;

export type SourceKey = (typeof SOURCES)[number]["key"];
