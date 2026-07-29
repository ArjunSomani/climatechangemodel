// Per-region default annual demand-growth rates, mirrored from
// engine/data/region_demand_growth.json (endpoint CAGR of historical total
// generation, 2020-2025, clipped to [0.5%, 4%]). Approximate historical
// estimates from a short, noisy window -- a sensible per-region starting point,
// overridable per run, not a load forecast.

export const REGION_DEMAND_GROWTH: Record<string, number> = {
  CAL: 0.04,
  CAR: 0.013,
  CENT: 0.023,
  FLA: 0.005,
  MIDA: 0.014,
  MIDW: 0.025,
  NE: 0.024,
  NW: 0.027,
  NY: 0.022,
  SE: 0.04,
  SW: 0.04,
  TEN: 0.021,
  TEX: 0.023,
};

const DEFAULT_GROWTH = 0.02;

export function regionDemandGrowth(region: string): number {
  return REGION_DEMAND_GROWTH[region] ?? DEFAULT_GROWTH;
}

// As a yearly multiplier for the demand TweakPair (e.g. 1.025 for 2.5%/yr).
export function regionDemandMultiplier(region: string): number {
  return 1 + regionDemandGrowth(region);
}
