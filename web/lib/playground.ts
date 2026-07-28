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

export function cellAt(lattice: Lattice, ci: number, mi: number): LatticeCell {
  return lattice.cells[`${ci}_${mi}`];
}
