import type { SourceKey } from "@/lib/sources";

// Per-year max build-rate caps: the largest fraction of the fleet the
// optimizer is allowed to grow each source by in a single simulated year.
// These caps are load-bearing -- they're why decarbonization plays out over
// years rather than instantly (you can't build a nuclear fleet overnight).
//
// Values are raw fractions of the fleet per year, mirrored from the engine
// data/Specs.csv Max_PCT row.
export const MAX_BUILD_RATE: Record<SourceKey, number> = {
  Solar: 0.024849306,
  Wind: 0.013272599,
  Nuclear: 0.019602988,
  Gas: 0.065921648,
  Coal: 0.005793315,
  Battery: 0.008197181,
};
