// Mortality externality coefficients and helpers, shared by the custom-run
// form and the results view. The numbers themselves come from Level
// (levelmodel.vercel.app) via data/mortality.json, which mirrors the engine's
// canonical engine/data/mortality.json exactly (a Python test enforces that
// the two stay identical). Optimize does not re-derive these figures; every
// coefficient links back to its Level source page.
import mortalityData from "@/data/mortality.json";
import { SOURCES, type SourceKey } from "@/lib/sources";
import type { YearRecord } from "@/lib/library";

export type Band = "low" | "central" | "high";

export interface MortalityCoefficient {
  low: number;
  central: number;
  high: number;
  unit: string;
  // Fraction of this source's deaths that are *modeled* (air-pollution and
  // radiation attributions from epidemiological models) rather than *counted*
  // (accidents -- recorded events). Level's distinction; must survive here.
  modeledShare: number;
  source: string;
  note?: string;
}

export const MORTALITY = mortalityData as Record<string, MortalityCoefficient>;

// Optimize builds/dispatches six technologies; each maps onto one Level key,
// except Battery -- its harm is embodied in the electricity it stores, so it
// carries no direct coefficient (documented, not a silent zero). oil and hydro
// exist in the data for reconcilability with Level but are never dispatched.
export const ENGINE_SOURCE_TO_MORTALITY_KEY: Record<SourceKey, string | null> = {
  Solar: "solar",
  Wind: "wind",
  Nuclear: "nuclear",
  Gas: "gas",
  Coal: "coal",
  Battery: null,
};

export const MWH_PER_TWH = 1_000_000;

// HHS's 2026 regulatory guidance publishes a VSL *range*, not a point estimate,
// in constant 2025 dollars. Presented as published values -- never as a
// recommended or correct figure (see disclosure copy).
export const VSL_PRESETS: { label: string; value: number }[] = [
  { label: "Low", value: 6_600_000 },
  { label: "Central", value: 14_100_000 },
  { label: "High", value: 21_500_000 },
];

export const VSL_MIN = 0;
export const VSL_MAX = 25_000_000;
export const VSL_STEP = 100_000;

// HHS also escalates VSL in real terms over time (~1.1%/yr real earnings
// growth, income elasticity 1.0). Applied as a per-year multiplier when the
// escalation toggle is on; 1.0 holds it flat.
export const VSL_ESCALATION_YEARLY = 1.011;

export function levelSourceUrl(sourceId: string): string {
  return `https://levelmodel.vercel.app/sources#${encodeURIComponent(sourceId)}`;
}

// --- Risk ladder -----------------------------------------------------------
// All seven Level sources, ranked most-to-least deadly for the signature
// risk-ladder chart. `dispatched` flags the five Optimize actually builds;
// oil and hydro ride along with demand in reality but aren't in the optimizer.
// `colorVar` reuses the site's validated per-source palette so a source's
// identity color is the same here as in every energy-mix chart.
export interface RiskLadderRow {
  key: string;
  label: string;
  low: number;
  central: number;
  high: number;
  modeledShare: number;
  source: string;
  note?: string;
  colorVar: string;
  dispatched: boolean;
}

const LADDER_META: Record<
  string,
  { label: string; colorVar: string; dispatched: boolean }
> = {
  coal: { label: "Coal", colorVar: "--series-coal", dispatched: true },
  oil: { label: "Oil", colorVar: "--eia-oil", dispatched: false },
  gas: { label: "Gas", colorVar: "--series-gas", dispatched: true },
  nuclear: { label: "Nuclear", colorVar: "--series-nuclear", dispatched: true },
  hydro: { label: "Hydro", colorVar: "--eia-hydro", dispatched: false },
  wind: { label: "Wind", colorVar: "--series-wind", dispatched: true },
  solar: { label: "Solar", colorVar: "--series-solar", dispatched: true },
};

export function riskLadder(): RiskLadderRow[] {
  return Object.entries(MORTALITY)
    .map(([key, c]) => ({
      key,
      label: LADDER_META[key]?.label ?? key,
      low: c.low,
      central: c.central,
      high: c.high,
      modeledShare: c.modeledShare,
      source: c.source,
      note: c.note,
      colorVar: LADDER_META[key]?.colorVar ?? "--ink-muted",
      dispatched: LADDER_META[key]?.dispatched ?? false,
    }))
    .sort((a, b) => b.central - a.central);
}

// One TWh is roughly the annual electricity of this many US homes
// (~10.8 MWh/home/yr, EIA). Lets deaths/TWh be stated at human scale.
export const HOMES_PER_TWH = 92_600;

export function coalVsSolarFactor(): number {
  return MORTALITY.coal.central / MORTALITY.solar.central;
}

export function deathRate(source: SourceKey, band: Band = "central"): number {
  const key = ENGINE_SOURCE_TO_MORTALITY_KEY[source];
  if (key === null) return 0;
  return MORTALITY[key][band];
}

// deaths = generation[TWh] * rate[deaths/TWh]; generation arrives in MWh, and
// 1 TWh = 1e6 MWh. One place, matching the engine's deaths_from_mwh.
export function deathsFromMwh(mwh: number, ratePerTwh: number): number {
  return (mwh / MWH_PER_TWH) * ratePerTwh;
}

export function formatVsl(value: number): string {
  if (value === 0) return "$0";
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

// --- Deaths computed from a run's per-source generation --------------------
// The engine reports deaths in its result; the custom-run status endpoint only
// carries the year records (per-source {Source}_MWh), so we recompute deaths
// here from the same mirrored coefficients. Pure function of generation, so it
// matches the engine's production-based figures exactly.

export interface SourceYearDeaths {
  source: SourceKey;
  low: number;
  central: number;
  high: number;
  modeledShare: number;
  countedCentral: number;
  modeledCentral: number;
}

export interface YearDeaths {
  year: number;
  low: number;
  central: number;
  high: number;
  countedCentral: number;
  modeledCentral: number;
  mwhTotal: number;
  bySource: SourceYearDeaths[];
}

export function computeYearDeaths(record: YearRecord): YearDeaths {
  const bySource: SourceYearDeaths[] = [];
  let low = 0,
    central = 0,
    high = 0,
    countedCentral = 0,
    modeledCentral = 0,
    mwhTotal = 0;

  for (const s of SOURCES) {
    const mwh = Number(record[`${s.key}_MWh`] ?? 0);
    mwhTotal += mwh;
    const key = ENGINE_SOURCE_TO_MORTALITY_KEY[s.key];
    if (key === null) continue; // Battery: no direct coefficient.
    const coeff = MORTALITY[key];
    const c = deathsFromMwh(mwh, coeff.central);
    const sd: SourceYearDeaths = {
      source: s.key,
      low: deathsFromMwh(mwh, coeff.low),
      central: c,
      high: deathsFromMwh(mwh, coeff.high),
      modeledShare: coeff.modeledShare,
      countedCentral: c * (1 - coeff.modeledShare),
      modeledCentral: c * coeff.modeledShare,
    };
    bySource.push(sd);
    low += sd.low;
    central += sd.central;
    high += sd.high;
    countedCentral += sd.countedCentral;
    modeledCentral += sd.modeledCentral;
  }

  return {
    year: Number(record.Year),
    low,
    central,
    high,
    countedCentral,
    modeledCentral,
    mwhTotal,
    bySource,
  };
}

export interface ScenarioDeaths {
  perYear: YearDeaths[];
  cumulativeLow: number;
  cumulativeCentral: number;
  cumulativeHigh: number;
  cumulativeCounted: number;
  cumulativeModeled: number;
  // Deaths per TWh of the whole modeled system over the horizon -- directly
  // comparable to Level's risk rule.
  deathsPerTwhCentral: number;
}

export function computeScenarioDeaths(records: YearRecord[]): ScenarioDeaths {
  const perYear = records.map(computeYearDeaths);
  const cumulativeLow = perYear.reduce((a, y) => a + y.low, 0);
  const cumulativeCentral = perYear.reduce((a, y) => a + y.central, 0);
  const cumulativeHigh = perYear.reduce((a, y) => a + y.high, 0);
  const cumulativeCounted = perYear.reduce((a, y) => a + y.countedCentral, 0);
  const cumulativeModeled = perYear.reduce((a, y) => a + y.modeledCentral, 0);
  const totalMwh = perYear.reduce((a, y) => a + y.mwhTotal, 0);
  const deathsPerTwhCentral =
    totalMwh > 0 ? cumulativeCentral / (totalMwh / MWH_PER_TWH) : 0;

  return {
    perYear,
    cumulativeLow,
    cumulativeCentral,
    cumulativeHigh,
    cumulativeCounted,
    cumulativeModeled,
    deathsPerTwhCentral,
  };
}
