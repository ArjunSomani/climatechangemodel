// Annual system-cost breakdown, computed web-side and validated to match the
// engine exactly (web variable/CO2 == engine _Variable_M$/_CO2_M$ ÷ sample_years,
// ratio 1.0000; capital/fixed come straight from the already-annual fields):
//
//   capital  = Σ _Capital_M$   (annual amortized mortgage payment, from the blob)
//   fixed    = Σ _Fixed_M$      (annual fixed O&M, from the blob)
//   variable = Σ _MWh × VARIABLE_COST                        (Specs.csv Variable_M$_MWh)
//   co2      = Σ _MWh × co2 intensity × CO2_M$_MT (per-year price, from the blob)
//   mortality (added by the caller) = deaths × VSL
//
// Variable/CO2 are recomputed rather than read from _Variable_M$/_CO2_M$ because
// those fields are summed over sample_years (see lib/co2.ts). All values are M$.
import { SOURCES } from "@/lib/sources";
import type { SourceKey } from "@/lib/sources";
import { CO2_INTENSITY } from "@/lib/co2";
import type { YearRecord } from "@/lib/library";

// Specs.csv Variable_M$_MWh row (M$ per MWh of variable O&M).
export const VARIABLE_COST: Record<SourceKey, number> = {
  Solar: 0,
  Wind: 0,
  Nuclear: 1.04477e-5,
  Gas: 3.21883e-5,
  Coal: 2.328e-5,
  Battery: 4.67932e-6,
};

export interface CostBreakdown {
  capital: number;
  fixed: number;
  variable: number;
  co2: number;
}

// The four externality-agnostic + CO2 components, all in M$ for the year.
export function operatingCosts(record: YearRecord): CostBreakdown {
  const co2Price = record["CO2_M$_MT"] ?? 0;
  let capital = 0;
  let fixed = 0;
  let variable = 0;
  let co2 = 0;
  for (const s of SOURCES) {
    const mwh = record[`${s.key}_MWh`] ?? 0;
    capital += record[`${s.key}_Capital_M$`] ?? 0;
    fixed += record[`${s.key}_Fixed_M$`] ?? 0;
    variable += mwh * VARIABLE_COST[s.key];
    co2 += mwh * CO2_INTENSITY[s.key] * co2Price;
  }
  return { capital, fixed, variable, co2 };
}
