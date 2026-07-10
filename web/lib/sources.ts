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

// Raw EIA data has 3 more sources than the engine optimizes (PRD Appendix A:
// "ride along with demand, not optimized" -- shown muted/grey, not given
// bright categorical slots, since they're not identity-comparable to the
// 5 build/dispatch sources above).
export const EIA_ONLY_SOURCES = [
  { key: "Hydro", label: "Hydro", color: "var(--eia-hydro)" },
  { key: "Oil", label: "Oil", color: "var(--eia-oil)" },
  { key: "Other", label: "Other", color: "var(--eia-other)" },
] as const;

export type EiaOnlySourceKey = (typeof EIA_ONLY_SOURCES)[number]["key"];
export type EiaSourceKey = Exclude<SourceKey, "Battery"> | EiaOnlySourceKey;

// All 8 sources present in the raw EIA data (no Battery -- that's a
// synthetic engine construct, not something EIA reports).
export const EIA_SOURCES: { key: EiaSourceKey; label: string; color: string }[] = [
  { key: "Solar", label: "Solar", color: "var(--series-solar)" },
  { key: "Wind", label: "Wind", color: "var(--series-wind)" },
  { key: "Nuclear", label: "Nuclear", color: "var(--series-nuclear)" },
  { key: "Gas", label: "Gas", color: "var(--series-gas)" },
  { key: "Coal", label: "Coal", color: "var(--series-coal)" },
  ...EIA_ONLY_SOURCES,
];
