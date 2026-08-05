// Pure helpers usable from client components -- must not import lib/db.ts
// (pulls the 'pg' package, which breaks the client bundle) or lib/library.ts
// non-type exports. Types are fine to import with `import type`.
import { co2MtFromGeneration } from "@/lib/co2";
import { operatingCosts } from "@/lib/costs";
import { computeYearDeaths } from "@/lib/mortality";
import { SOURCES } from "@/lib/sources";
import type { LibraryCaseSummary, YearRecord } from "@/lib/library";

function humanize(s: string): string {
  return s.replace(/_/g, " ");
}

export function caseLabel(c: LibraryCaseSummary): string {
  // Mortality-priced cases: the catalog columns are CO2-centric and can't hold
  // the mortality price (it lives in `config`), so identify them by the
  // self-describing variant instead of a misleading "$0/MT".
  if (c.group_name === "Mortality") {
    const carbon = c.co2_initial > 0 ? `$${c.co2_initial}/MT CO₂` : "no carbon";
    return `${c.region} · ${humanize(c.variant)} · ${carbon}`;
  }
  const variantPart =
    c.variant !== "Default" ? ` ${humanize(c.variant)}` : "";
  const co2Part =
    c.co2_regime === "Increasing_CO2"
      ? `+$${c.co2_initial}/yr to $${c.co2_yearly}`
      : `$${c.co2_initial}/MT`;
  return `${c.region} · ${humanize(c.group_name)}${variantPart} · ${co2Part}`;
}

// Annual CO2 (Mt) for a year. Computed from per-year generation x intensity
// (see lib/co2.ts) rather than the engine's `{s}_CO2_MT` field, which is
// sample_years-inflated. Same pattern as deaths, so both externalities agree.
export function totalCO2MT(record: YearRecord): number {
  return co2MtFromGeneration(record);
}

// --- Intensity metrics -----------------------------------------------------
// Absolutes (Mt, deaths, $) aren't comparable across 13 regions of wildly
// different size, and over 25 years they aren't intelligible. Normalized per
// unit of energy they are: a scenario gets a position on the same instruments
// everyone already reads (gCO2/kWh, deaths/TWh, $/MWh). Intensities are also a
// correctness net -- an annual-vs-cumulative slip that hides in "1,540 Mt"
// shows up instantly as 2,136 gCO2/kWh, which no real grid can be.

// Total generation (MWh) actually produced in a year, summed across the six
// dispatched sources. The denominator for every intensity below.
export function totalGenerationMWh(record: YearRecord): number {
  return SOURCES.reduce((sum, s) => sum + (Number(record[`${s.key}_MWh`]) || 0), 0);
}

// Carbon intensity in gCO2/kWh. CO2 is in Mt (1e12 g); generation in MWh
// (1e3 kWh); Mt/MWh x 1e9 = g/kWh. This is the number every energy conversation
// uses, and it must land in a physically possible band (see PLAUSIBLE_G_PER_KWH).
export function carbonIntensityGPerKwh(record: YearRecord): number {
  const mwh = totalGenerationMWh(record);
  if (mwh <= 0) return 0;
  return (co2MtFromGeneration(record) / mwh) * 1e9;
}

// Nothing on this grid is dirtier than unabated coal (~820-1000 gCO2/kWh), so a
// fleet-average intensity above ~1000 is physically impossible -- exactly the
// class of bug the cumulative-vs-annual mislabel was. Mirror of the engine's
// MAX_PLAUSIBLE_G_PER_KWH (test_co2_intensity.py); asserted in the web tests.
export const PLAUSIBLE_G_PER_KWH = 1000;

// Deaths per TWh of generation, central estimate -- directly comparable to the
// per-source risk ladder on the Safety page, so a scenario's mix gets a position
// on the same instrument the individual sources do.
export function deathsPerTWh(record: YearRecord): number {
  const mwh = totalGenerationMWh(record);
  if (mwh <= 0) return 0;
  return computeYearDeaths(record).central / (mwh / 1_000_000);
}

// System busbar cost in $/MWh (LCOE), Lazard-comparable: the physical resource
// cost of the energy -- capital + fixed + variable O&M -- divided by generation.
// Deliberately EXCLUDES the CO2 price and the mortality price: those are policy
// overlays on top of cost, not the cost of building and running the grid, and
// folding them in would make the number incomparable to any published LCOE.
// operatingCosts returns M$ (x1e6 -> $).
export function lcoePerMWh(record: YearRecord): number {
  const mwh = totalGenerationMWh(record);
  if (mwh <= 0) return 0;
  const { capital, fixed, variable } = operatingCosts(record);
  return ((capital + fixed + variable) * 1_000_000) / mwh;
}

// --- Cumulative over the horizon -------------------------------------------
// A final-year figure describes an endpoint; the cumulative figure describes the
// PATH, which is the whole reason to run a dynamic model instead of comparing
// static mixes. Two scenarios can reach an identical 2050 grid with very
// different cumulative CO2 and deaths depending on how fast coal left -- and for
// CO2 the cumulative total, not the 2050 rate, is what actually drives warming.

export interface CumulativeTotals {
  co2Mt: number;
  deathsCentral: number;
  generationMWh: number;
}

export function cumulativeTotals(records: YearRecord[]): CumulativeTotals {
  let co2Mt = 0;
  let deathsCentral = 0;
  let generationMWh = 0;
  for (const r of records) {
    co2Mt += co2MtFromGeneration(r);
    deathsCentral += computeYearDeaths(r).central;
    generationMWh += totalGenerationMWh(r);
  }
  return { co2Mt, deathsCentral, generationMWh };
}
