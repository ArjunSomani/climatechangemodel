// Sum regional results into a national ("All US") total. Valid precisely because
// the model optimizes each region independently with no transmission between
// them: the US grid here IS the sum of the 13 regional grids. Generation,
// capacity, emissions, deaths, and the additive cost fields all add; capacity
// factor is re-derived from the summed generation and capacity. Everything the
// result views compute (CO2, deaths, costs) then works on the aggregate exactly
// as on a single region.
//
// Caveat worth surfacing in the UI: this is an aggregate of independent regional
// optimizations, not a co-optimized national grid, and every region used the
// same demand-growth assumption (per-region growth would need re-running each
// region -- see MORTALITY.md follow-ups).
import { SOURCES } from "@/lib/sources";
import type { LibraryCaseDetail, YearRecord } from "@/lib/library";

const HOURS_PER_YEAR = 8766; // 365.25 * 24

// Per-source fields that are additive across regions.
const SOURCE_SUFFIXES = [
  "_MWh",
  "_MW",
  "_Capital_M$",
  "_Fixed_M$",
  "_Variable_M$",
  "_CO2_M$",
  "_CO2_MT",
];
const ADDITIVE_GLOBALS = ["Target_MWh", "Outage_MWh"];
// Prices/rates are the same across regions for one scenario -- carry, don't sum.
const CARRY_GLOBALS = ["CO2_M$_MT", "Outage_M$_MWh"];

export function aggregateRegions(cases: LibraryCaseDetail[]): YearRecord[] {
  if (cases.length === 0) return [];

  // Use the first case's year spine; the standard library runs share a horizon.
  const years = cases[0].result.map((r) => r.Year);

  return years.map((year) => {
    const perYear = cases
      .map((c) => c.result.find((r) => r.Year === year))
      .filter((r): r is YearRecord => r !== undefined);

    const agg: Record<string, number> = { Year: year };

    for (const key of CARRY_GLOBALS) agg[key] = perYear[0]?.[key] ?? 0;

    const sumKeys = [
      ...ADDITIVE_GLOBALS,
      ...SOURCES.flatMap((s) => SOURCE_SUFFIXES.map((suf) => `${s.key}${suf}`)),
    ];
    for (const key of sumKeys) {
      agg[key] = perYear.reduce((sum, r) => sum + (r[key] ?? 0), 0);
    }

    // Capacity factor is a ratio, so re-derive it from summed MWh / MW.
    for (const s of SOURCES) {
      const mwh = agg[`${s.key}_MWh`] ?? 0;
      const mw = agg[`${s.key}_MW`] ?? 0;
      agg[`${s.key}_Cap_Factor`] = mw > 0 ? mwh / (mw * HOURS_PER_YEAR) : 0;
    }

    return agg as YearRecord;
  });
}

// From a flat list of case summaries, find the scenario config (everything but
// region) with the most regions available, and return its regional case_ids --
// so "All US" always uses the most complete cross-section the library has.
export function mostCompleteConfigCaseIds(
  cases: {
    case_id: string;
    group_name: string;
    variant: string;
    co2_regime: string;
    co2_initial: number;
    co2_yearly: number;
  }[]
): { caseIds: string[]; regionCount: number } {
  const groups = new Map<string, string[]>();
  for (const c of cases) {
    const key = `${c.group_name}|${c.variant}|${c.co2_regime}|${c.co2_initial}|${c.co2_yearly}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(c.case_id);
  }
  let best: string[] = [];
  for (const ids of groups.values()) if (ids.length > best.length) best = ids;
  return { caseIds: best, regionCount: best.length };
}
