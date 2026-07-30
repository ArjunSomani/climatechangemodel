import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect } from "playwright/test";
import {
  aggregateRegions,
  dedupeByRegion,
  mostCompleteConfigCaseIds,
} from "@/lib/aggregate";
import { formatEnergyIn, formatPowerIn, pickEnergyUnit, pickPowerUnit } from "@/lib/format";
import { cellAt, type Lattice } from "@/lib/playground";
import { regionDemandGrowth, regionDemandMultiplier } from "@/lib/regionDemand";
import {
  defaultScenarioConfig,
  draftIssues,
  draftToConfig,
  parseScenarioConfigFile,
  validateScenarioConfig,
  type ScenarioDraft,
} from "@/lib/scenarioConfig";

// Pure-logic regressions. No browser needed -- these exercise the modules
// directly, so a failure points at the function rather than at a page.
// Every case below corresponds to a bug that was actually present.

// --- Prototype-chain lookups ---------------------------------------------

test.describe("object lookups don't fall through to the prototype", () => {
  const PROTOTYPE_KEYS = [
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "__proto__",
  ];

  test("region validation rejects prototype keys", () => {
    // `c.region in REGIONS` was true for every one of these, because `in` walks
    // the prototype chain -- so a config with region "constructor" passed the
    // check whose stated job is "reject bad input here rather than crash
    // run_worker.py", and went to the engine.
    for (const key of PROTOTYPE_KEYS) {
      const config = { ...defaultScenarioConfig(), region: key };
      expect(validateScenarioConfig(config), `region "${key}" was accepted`).toBeNull();
    }
    expect(validateScenarioConfig(defaultScenarioConfig())).not.toBeNull();
  });

  test("demand growth returns a number for prototype keys", () => {
    // REGION_DEMAND_GROWTH["constructor"] returns the Object constructor
    // *function*, which is neither null nor undefined, so `?? DEFAULT` never
    // fired. regionDemandMultiplier's `1 + growth` then string-concatenated:
    // "1function Object() { [native code] }".
    for (const key of PROTOTYPE_KEYS) {
      const growth = regionDemandGrowth(key);
      const multiplier = regionDemandMultiplier(key);
      expect(typeof growth, `growth for "${key}"`).toBe("number");
      expect(Number.isFinite(growth)).toBe(true);
      expect(typeof multiplier, `multiplier for "${key}"`).toBe("number");
      expect(Number.isFinite(multiplier)).toBe(true);
    }
    expect(regionDemandGrowth("CAL")).toBe(0.04);
  });
});

// --- National aggregation ------------------------------------------------

type FakeCase = ReturnType<typeof makeCase>;
function makeCase(region: string, years: number[], mwhPerYear: number) {
  return {
    region,
    case_id: `group/${region}`,
    group_name: "G",
    variant: "V",
    co2_regime: "Constant_CO2",
    co2_initial: 0,
    co2_yearly: 0,
    years: years.length,
    engine_version: "test",
    specs_version: "test",
    eia_version: "test",
    created_at: "2026-01-01",
    config: null,
    result: years.map((Year) => ({
      Year,
      Target_MWh: mwhPerYear,
      Solar_MWh: mwhPerYear,
    })),
  } as unknown as Parameters<typeof aggregateRegions>[0][number];
}

test.describe("aggregateRegions cannot silently publish a partial total", () => {
  test("a shorter horizon truncates the spine instead of dropping regions", () => {
    // Previously the year spine came from cases[0] and each year summed
    // whichever cases contained it. A 2-year region among 3-year ones made the
    // third year the sum of a subset, drawn as the whole country.
    const cases: FakeCase[] = [
      makeCase("CAL", [2025, 2026, 2027], 100),
      makeCase("TEX", [2025, 2026], 100),
    ];
    const agg = aggregateRegions(cases);

    expect(agg.map((r) => r.Year)).toEqual([2025, 2026]);
    for (const row of agg) {
      expect(row.Target_MWh, `year ${row.Year} summed a subset of regions`).toBe(200);
    }
  });

  test("a repeated region is counted once", () => {
    const cases: FakeCase[] = [
      makeCase("CAL", [2025], 100),
      makeCase("CAL", [2025], 100),
      makeCase("TEX", [2025], 100),
    ];
    expect(dedupeByRegion(cases)).toHaveLength(2);
    expect(aggregateRegions(cases)[0].Target_MWh).toBe(200);
  });

  test("no shared years yields nothing rather than a wrong number", () => {
    const agg = aggregateRegions([
      makeCase("CAL", [2025], 100),
      makeCase("TEX", [2030], 100),
    ]);
    expect(agg).toEqual([]);
  });
});

test("mostCompleteConfigCaseIds ranks by distinct regions, not row count", () => {
  // The group key omits the mortality price (it lives in `config`, not a
  // column), so several mortality variants of one region share a key. Ranking
  // by raw row count could therefore pick a 4-row/2-region group over a
  // 3-row/3-region one, and then aggregate the same region three times.
  const summary = (case_id: string, region: string, group_name: string) => ({
    case_id,
    region,
    group_name,
    variant: "V",
    co2_regime: "Constant_CO2",
    co2_initial: 0,
    co2_yearly: 0,
  });

  const picked = mostCompleteConfigCaseIds([
    summary("m/CAL/a", "CAL", "Mortality"),
    summary("m/CAL/b", "CAL", "Mortality"),
    summary("m/CAL/c", "CAL", "Mortality"),
    summary("m/TEX/a", "TEX", "Mortality"),
    summary("d/CAL", "CAL", "Default"),
    summary("d/TEX", "TEX", "Default"),
    summary("d/NY", "NY", "Default"),
  ]);

  expect(picked.regionCount).toBe(3);
  expect(picked.caseIds.sort()).toEqual(["d/CAL", "d/NY", "d/TEX"]);
});

// --- Formatting ----------------------------------------------------------

test("negative magnitudes format like their positive counterparts", () => {
  // `scaled < 10 ? 1 : 0` took the one-decimal branch for every negative value,
  // so -50 TWh printed as "-50.0 TWh" beside "50 TWh". formatEnergy (the
  // sibling) already used Math.abs; these two didn't.
  const eu = pickEnergyUnit(50_000_000);
  expect(formatEnergyIn(-50_000_000, eu).replace("-", "")).toBe(
    formatEnergyIn(50_000_000, eu)
  );
  const pu = pickPowerUnit(50_000);
  expect(formatPowerIn(-50_000, pu).replace("-", "")).toBe(formatPowerIn(50_000, pu));
});

// --- Playground lattice --------------------------------------------------

test("cellAt never returns undefined for an in-range index", () => {
  // The declared return type was LatticeCell, but a missing key yields undefined
  // and every caller dereferences it immediately.
  const lattice: Lattice = {
    region: "MIDW",
    years: 25,
    sources: [],
    carbonPrices: [0, 100],
    mortalityPrices: [0, 1_000_000],
    mortalityVersion: "test",
    cells: {
      "0_0": {
        finalMixMWh: {},
        co2FinalMT: 1,
        deathsCentral: 1,
        deathsLow: 0,
        deathsHigh: 2,
        cumulativeDeathsCentral: 5,
      },
    },
  };
  // "1_1" is in range but absent from this deliberately sparse lattice.
  expect(cellAt(lattice, 1, 1)).toBeDefined();
  expect(cellAt(lattice, 0, 0)).toBeDefined();
  // Out of range clamps rather than throwing.
  expect(cellAt(lattice, 99, 99)).toBeDefined();
});

// --- Draft / empty-field handling ----------------------------------------

test.describe("an empty numeric field is not zero", () => {
  function draftWith(mutate: (d: ScenarioDraft) => void): ScenarioDraft {
    const d = defaultScenarioConfig() as unknown as ScenarioDraft;
    // Deep-clone so mutations don't leak between assertions.
    const clone = JSON.parse(JSON.stringify(d)) as ScenarioDraft;
    mutate(clone);
    return clone;
  }

  test("a cleared per-source multiplier blocks submission", () => {
    // This is the bug in full: 0 is a legitimate capital-cost multiplier, so a
    // cleared field submitted as `0` passed validation and queued a real run in
    // which that technology was free to build. Verified end to end at the time:
    // cleared field -> API 200 -> run queued, no warning anywhere.
    const draft = draftWith((d) => {
      d.sources.Solar.capital.initial = null;
    });
    expect(draftToConfig(draft)).toBeNull();
    expect(draftIssues(draft)).toEqual(["Solar capital (initial)"]);
  });

  test("zero is still a valid value", () => {
    const draft = draftWith((d) => {
      d.sources.Solar.capital.initial = 0;
      d.co2_price.initial = 0;
    });
    expect(draftIssues(draft)).toEqual([]);
    expect(draftToConfig(draft)).not.toBeNull();
  });

  test("every empty field is reported, not just the first", () => {
    const draft = draftWith((d) => {
      d.years = null;
      d.co2_price.initial = null;
      d.sources.Coal.lifetime.yearly = null;
    });
    const issues = draftIssues(draft);
    expect(issues).toHaveLength(3);
    expect(issues).toContain("Years");
    expect(issues).toContain("CO₂ price (initial)");
    expect(issues).toContain("Coal lifetime (yearly)");
  });

  test("a complete draft converts to a config the validator accepts", () => {
    const draft = draftWith(() => {});
    const config = draftToConfig(draft);
    expect(config).not.toBeNull();
    expect(validateScenarioConfig(config)).not.toBeNull();
  });
});

// --- Saved-scenario round trip -------------------------------------------

test("a saved scenario file round-trips and rejects junk", () => {
  const config = defaultScenarioConfig();
  const saved = JSON.stringify({
    type: "optimize-scenario-config",
    version: 1,
    config,
  });
  expect(parseScenarioConfigFile(saved)).toEqual(config);
  // The results-export shape ({ config, result }) loads too.
  expect(
    parseScenarioConfigFile(JSON.stringify({ config, result: [] }))
  ).toEqual(config);

  expect(parseScenarioConfigFile("not json")).toBeNull();
  expect(parseScenarioConfigFile("{}")).toBeNull();
  expect(
    parseScenarioConfigFile(JSON.stringify({ config: { ...config, years: 0 } }))
  ).toBeNull();
  expect(
    parseScenarioConfigFile(JSON.stringify({ config: { ...config, years: 51 } }))
  ).toBeNull();
  expect(
    parseScenarioConfigFile(
      JSON.stringify({ config: { ...config, region: "constructor" } })
    )
  ).toBeNull();
});

// --- Shipped preset sanity ------------------------------------------------

test("a carbon-price preset that claims to rise actually rises", async () => {
  // The engine reads co2_price as (year-one price AND annual increment) and
  // (ceiling) -- see engine/tests/test_co2_price_ramp.py. Reading the two fields
  // as (start, step) is the natural but wrong interpretation, and it fails
  // silently: a ceiling below the start simply never increments.
  //
  // The shipped "Rising carbon price" preset was {initial: 50, yearly: 10},
  // labelled "Starts at $50/ton, climbs $10 every year". It held flat at $50 for
  // the whole 25-year horizon. Parsed from source rather than imported, because
  // the presets live inside a "use client" page module.
  const src = await readFile(resolve("app/custom-run/page.tsx"), "utf8");

  const presets = [
    ...src.matchAll(
      /label:\s*"([^"]+)",\s*\n\s*blurb:\s*"([^"]+)",\s*\n\s*apply:[\s\S]*?co2_price:\s*\{\s*initial:\s*([\d_]+),\s*yearly:\s*([\d_]+)\s*\}/g
    ),
  ].map((m) => ({
    label: m[1],
    blurb: m[2],
    initial: Number(m[3].replace(/_/g, "")),
    yearly: Number(m[4].replace(/_/g, "")),
  }));

  expect(presets.length, "no co2_price presets parsed").toBeGreaterThan(0);

  for (const p of presets) {
    const claimsToRise = /ris|climb|increas|adds another/i.test(
      `${p.label} ${p.blurb}`
    );
    // The engine only increments while price < yearly, so a ramp requires the
    // ceiling to sit above the first year's price.
    const actuallyRises = p.yearly > p.initial;
    expect(
      actuallyRises,
      `preset "${p.label}" is described as rising ("${p.blurb}") but ` +
        `initial=${p.initial} >= yearly=${p.yearly}, so the engine holds it ` +
        `flat at $${p.initial} for the whole horizon`
    ).toBe(claimsToRise);
  }
});
