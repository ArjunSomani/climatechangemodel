// Operational water use per source, from Macknick et al. (2012) via
// data/water.json (mirrored from the engine's canonical copy; a Python test
// enforces they stay identical). Reported, not priced -- computed web-side the
// same way CO2 and deaths are: per-year generation x coefficient. Water is the
// axis where the 13-region structure finally pays off, because unlike carbon
// (global, a ton is a ton anywhere) water is intensely local.
//
// Two numbers, deliberately kept distinct -- the same counted-vs-modeled care as
// deaths: WITHDRAWAL is water taken from a source (most of it returned, warmer);
// CONSUMPTION is the part evaporated and gone. Nuclear withdraws the most; coal
// consumes among the most; solar and wind are essentially dry -- so carbon
// pricing (which favors nuclear) and water scarcity (which pushes against it)
// genuinely disagree.
import waterData from "@/data/water.json";
import { SOURCES, type SourceKey } from "@/lib/sources";
import type { YearRecord } from "@/lib/library";

export interface WaterFactor {
  withdrawal: number; // gal/MWh
  consumption: number; // gal/MWh
  source: string;
  note?: string;
}

interface WaterMeta {
  source: string;
  citation: string;
  unit: string;
  coolingSystem: string;
  note: string;
}

const RAW = waterData as Record<string, unknown>;
export const WATER_META = RAW._meta as WaterMeta;
export const WATER: Record<string, WaterFactor> = Object.fromEntries(
  Object.entries(RAW).filter(([k]) => k !== "_meta")
) as Record<string, WaterFactor>;

// Battery carries no direct water coefficient -- its footprint is embodied in the
// electricity it stores, exactly as it carries no direct mortality coefficient.
// Documented here, not a silent zero.
export const ENGINE_SOURCE_TO_WATER_KEY: Record<SourceKey, string | null> = {
  Solar: "solar",
  Wind: "wind",
  Nuclear: "nuclear",
  Gas: "gas",
  Coal: "coal",
  Battery: null,
};

const GAL_PER_MWH_TO_MGAL = 1e-6; // gallons -> million gallons

export interface WaterUse {
  withdrawalMgal: number; // million gallons
  consumptionMgal: number; // million gallons
  generationMWh: number;
}

// Water withdrawn and consumed in a year (million gallons), summed across the
// dispatched sources. Pure function of generation, like co2MtFromGeneration.
export function waterUseForYear(record: YearRecord): WaterUse {
  let withdrawalMgal = 0;
  let consumptionMgal = 0;
  let generationMWh = 0;
  for (const s of SOURCES) {
    const mwh = Number(record[`${s.key}_MWh`]) || 0;
    generationMWh += mwh;
    const key = ENGINE_SOURCE_TO_WATER_KEY[s.key];
    if (key === null) continue; // Battery
    const f = WATER[key];
    if (!f) continue;
    withdrawalMgal += mwh * f.withdrawal * GAL_PER_MWH_TO_MGAL;
    consumptionMgal += mwh * f.consumption * GAL_PER_MWH_TO_MGAL;
  }
  return { withdrawalMgal, consumptionMgal, generationMWh };
}

export function cumulativeWaterUse(records: YearRecord[]): WaterUse {
  let withdrawalMgal = 0;
  let consumptionMgal = 0;
  let generationMWh = 0;
  for (const r of records) {
    const w = waterUseForYear(r);
    withdrawalMgal += w.withdrawalMgal;
    consumptionMgal += w.consumptionMgal;
    generationMWh += w.generationMWh;
  }
  return { withdrawalMgal, consumptionMgal, generationMWh };
}

// Withdrawal/consumption intensity (gal/MWh) of a whole mix in a year -- directly
// comparable to the per-source factors, so a scenario gets a position on the same
// instrument the technologies do (like deaths/TWh on the risk ladder).
export function waterIntensityGalPerMWh(record: YearRecord): {
  withdrawal: number;
  consumption: number;
} {
  const { withdrawalMgal, consumptionMgal, generationMWh } = waterUseForYear(record);
  if (generationMWh <= 0) return { withdrawal: 0, consumption: 0 };
  // Mgal / MWh * 1e6 = gal/MWh.
  return {
    withdrawal: (withdrawalMgal / generationMWh) * 1e6,
    consumption: (consumptionMgal / generationMWh) * 1e6,
  };
}

// --- Water ladder ----------------------------------------------------------
// The five dispatched sources ranked by withdrawal, for a per-source reference
// chart -- the water analog of the mortality risk ladder. colorVar reuses the
// site's per-source palette so a source's identity color is consistent.
export interface WaterLadderRow {
  key: SourceKey;
  label: string;
  withdrawal: number;
  consumption: number;
  colorVar: string;
  note?: string;
}

const LADDER_COLOR: Record<string, string> = {
  Coal: "--series-coal",
  Gas: "--series-gas",
  Nuclear: "--series-nuclear",
  Solar: "--series-solar",
  Wind: "--series-wind",
};

export function waterLadder(): WaterLadderRow[] {
  const rows: WaterLadderRow[] = [];
  for (const s of SOURCES) {
    const key = ENGINE_SOURCE_TO_WATER_KEY[s.key];
    const f = key ? WATER[key] : null;
    if (!f) continue;
    rows.push({
      key: s.key,
      label: s.label,
      withdrawal: f.withdrawal,
      consumption: f.consumption,
      colorVar: LADDER_COLOR[s.key] ?? "--ink-muted",
      note: f.note,
    });
  }
  return rows.sort((a, b) => b.withdrawal - a.withdrawal);
}
