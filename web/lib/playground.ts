// Types for the pre-computed (carbon × mortality) price lattice that drives the
// two-slider playground. The lattice is generated offline by
// engine/scripts/generate_playground_lattice.py (each cell is one optimizer
// run); the UI just snaps the sliders to grid points and reads the nearest
// cell, so the response is instant.
import type { SourceKey } from "@/lib/sources";

export interface LatticeCell {
  finalMixMWh: Record<string, number>;
  co2FinalMT: number;
  deathsCentral: number;
  deathsLow: number;
  deathsHigh: number;
  cumulativeDeathsCentral: number;
  // Whole-horizon totals, for marginal abatement cost vs the no-pricing baseline.
  // CO2 (Mt) and busbar cost (M$) recomputed from generation the same corrected
  // way the web does (never the sample_years-inflated engine fields).
  cumulativeCO2MT: number;
  cumulativeCostMDollar: number;
}

export interface Lattice {
  region: string;
  years: number;
  sources: SourceKey[];
  carbonPrices: number[];
  mortalityPrices: number[];
  mortalityVersion: string;
  cells: Record<string, LatticeCell>;
}

// The return type used to be a bare LatticeCell, which was a lie: an index pair
// with no cell yields undefined and every caller dereferences it immediately. In
// practice the generator emits a full grid, but it runs in parallel and a partial
// regeneration would turn a missing cell into a TypeError rather than anything
// diagnosable. Clamping keeps the slider readable and makes the failure mode
// "shows a neighbouring cell" instead of "crashes the page".
// --- Marginal abatement cost ------------------------------------------------
// Not "what does this grid cost" but "what does buying this reduction cost" --
// the actual policy question. Relative to the no-pricing baseline (the 0_0
// cell): the extra system cost the pricing induced, divided by the CO2 and the
// deaths it removed. Both over the full horizon (cumulative), because a program's
// abatement cost is its total spend over its total reductions, not one year's.
//
// The $/death figure then answers a question no other tool asks: is it above or
// below the VSL the user set? If a user prices deaths at $14.1M and the grid
// avoids them at an implied $2M each, the price bought reductions far cheaper
// than the user's own stated worth. If it comes out at $30M, the price is buying
// reductions that cost more than the user says a life is worth.
export interface Abatement {
  deltaCostMDollar: number; // extra system cost vs baseline (M$; may be < 0)
  co2AvoidedMT: number; // Mt CO2 removed vs baseline (may be < 0)
  deathsAvoided: number; // deaths removed vs baseline (may be < 0)
  dollarsPerTonCO2: number | null; // null when nothing was avoided
  dollarsPerDeath: number | null; // null when no deaths were avoided
}

export function abatementVsBaseline(
  cell: LatticeCell,
  baseline: LatticeCell
): Abatement {
  const deltaCostMDollar = cell.cumulativeCostMDollar - baseline.cumulativeCostMDollar;
  const co2AvoidedMT = baseline.cumulativeCO2MT - cell.cumulativeCO2MT;
  const deathsAvoided =
    baseline.cumulativeDeathsCentral - cell.cumulativeDeathsCentral;

  // M$ -> $ for the per-ton and per-death figures. Only meaningful when the
  // denominator is a real reduction; a price that avoids ~nothing has an
  // undefined, not infinite, unit cost.
  const EPS_TON = 1e-3; // Mt
  const EPS_DEATH = 1e-3; // deaths
  return {
    deltaCostMDollar,
    co2AvoidedMT,
    deathsAvoided,
    dollarsPerTonCO2:
      co2AvoidedMT > EPS_TON
        ? (deltaCostMDollar * 1_000_000) / (co2AvoidedMT * 1_000_000)
        : null,
    dollarsPerDeath:
      deathsAvoided > EPS_DEATH
        ? (deltaCostMDollar * 1_000_000) / deathsAvoided
        : null,
  };
}

export function cellAt(lattice: Lattice, ci: number, mi: number): LatticeCell {
  const exact = lattice.cells[`${ci}_${mi}`];
  if (exact) return exact;

  const clampedCi = Math.min(Math.max(ci, 0), lattice.carbonPrices.length - 1);
  const clampedMi = Math.min(Math.max(mi, 0), lattice.mortalityPrices.length - 1);
  const clamped = lattice.cells[`${clampedCi}_${clampedMi}`];
  if (clamped) return clamped;

  const first = Object.values(lattice.cells)[0];
  if (!first) {
    throw new Error("playground lattice contains no cells");
  }
  return first;
}
