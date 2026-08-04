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

// One case per region, first occurrence wins. Exported so a caller can label a
// total with the number of regions actually summed rather than the number of
// cases it passed in -- /us renders "Summed across N regions", and those were
// different numbers whenever a region appeared twice.
export function dedupeByRegion(
  cases: LibraryCaseDetail[]
): LibraryCaseDetail[] {
  const byRegion = new Map<string, LibraryCaseDetail>();
  for (const c of cases) {
    if (!byRegion.has(c.region)) byRegion.set(c.region, c);
  }
  return [...byRegion.values()];
}

// Two ways this could previously publish a wrong national total without saying
// so. Neither is triggered by the library as it stands (all 597 cases share a
// 25-year horizon, and no config group currently has a repeated region), so both
// were latent -- but the page this feeds is headed "The United States grid", and
// a silently wrong number there is the worst failure available to this codebase.
//
// 1. Horizon mismatch. The year spine came from cases[0], and each year then
//    summed whichever cases happened to contain it, dropping the rest. One
//    20-year case among 25-year ones would have made years 21-25 the sum of a
//    subset, drawn as though it were the whole country -- a cliff in national
//    demand with no explanation. The spine is now the INTERSECTION of years, so
//    every plotted point sums the same complete set of regions.
//
// 2. Duplicate regions. Callers choose what to aggregate and nothing here
//    checked that a region appeared once, so a region present twice was summed
//    twice into the national figure.
export function aggregateRegions(cases: LibraryCaseDetail[]): YearRecord[] {
  if (cases.length === 0) return [];

  const unique = dedupeByRegion(cases);

  // Intersection of every case's years, in the first case's order.
  const yearSets = unique.map((c) => new Set(c.result.map((r) => r.Year)));
  const years = unique[0].result
    .map((r) => r.Year)
    .filter((y) => yearSets.every((set) => set.has(y)));

  if (years.length === 0) return [];

  return years.map((year) => {
    const perYear = unique
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
    region: string;
    group_name: string;
    variant: string;
    co2_regime: string;
    co2_initial: number;
    co2_yearly: number;
  }[]
): { caseIds: string[]; regionCount: number } {
  // Keyed on everything the catalog columns expose about a config -- which is
  // NOT everything that distinguishes a run. The mortality price lives in
  // `config`, not in a column, so two mortality variants of the same region can
  // share a key. Keeping one case per region inside each group means the winner
  // can never contain a region twice, and makes "most complete" mean the most
  // regions rather than the most rows.
  const groups = new Map<string, Map<string, string>>();
  for (const c of cases) {
    const key = `${c.group_name}|${c.variant}|${c.co2_regime}|${c.co2_initial}|${c.co2_yearly}`;
    let group = groups.get(key);
    if (!group) {
      group = new Map<string, string>();
      groups.set(key, group);
    }
    if (!group.has(c.region)) group.set(c.region, c.case_id);
  }

  let best: string[] = [];
  for (const group of groups.values()) {
    if (group.size > best.length) best = [...group.values()];
  }
  return { caseIds: best, regionCount: best.length };
}
