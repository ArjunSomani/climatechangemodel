// CO2 intensity per generation source, mirrored from the engine's Specs.csv
// (the CO2_MT_MWh row). Kept in sync by hand -- see engine/optimize_engine
// constants; the values are stable (generated from the source spreadsheet).
//
// Why the web computes CO2 instead of reading the engine's `{s}_CO2_MT` field:
// that field is summed over the engine's sample_years and never normalized back
// to a per-year figure (faithful to the original Optimize.py and locked by the
// golden parity tests), so it over-reports annual CO2 by that factor. Deaths are
// already computed web-side from per-year generation x coefficient; CO2 is done
// the same way here, from the per-year `{s}_MWh` (which IS normalized), so the
// two externalities are counted consistently and the number is physically right.
//
// Units: intensity is in Mt of CO2 per (MWh x 1e6) -- i.e. multiplying by a
// per-year MWh figure yields annual CO2 in Mt, matching the site's "MT" columns.
import { SOURCES } from "@/lib/sources";
import type { SourceKey } from "@/lib/sources";
import type { YearRecord } from "@/lib/library";

export const CO2_INTENSITY: Record<SourceKey, number> = {
  Solar: 6.4e-8,
  Wind: 1.215e-8,
  Nuclear: 1.4e-8,
  Gas: 4.5e-7,
  Coal: 8.63e-7,
  Battery: 3.28896e-8,
};

// Annual CO2 (Mt) for a single year record: per-year generation x intensity,
// summed across sources.
export function co2MtFromGeneration(record: YearRecord): number {
  return SOURCES.reduce(
    (sum, s) => sum + (record[`${s.key}_MWh`] ?? 0) * CO2_INTENSITY[s.key],
    0
  );
}
