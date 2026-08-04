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
