import { test, expect } from "playwright/test";
import { co2MtFromGeneration, CO2_INTENSITY } from "@/lib/co2";
import { operatingCosts, VARIABLE_COST } from "@/lib/costs";
import type { YearRecord } from "@/lib/library";

// Golden lock on the web-side externality math -- the code that fixes the
// engine's 6x CO2 over-report by recomputing annual CO2 and variable/CO2 cost
// from per-year generation instead of reading the sample_years-inflated
// {s}_CO2_MT / {s}_Variable_M$ / {s}_CO2_M$ fields (see lib/co2.ts, lib/costs.ts).
//
// A Python test (engine/tests/test_co2_mirror.py) already asserts the CO2
// intensity CONSTANTS match Specs.csv, but nothing executes the TS ARITHMETIC.
// These tests do, with hand-computed expectations, and -- crucially -- prove the
// functions ignore the raw engine fields, so a regression that reverts to
// reading them fails here instead of shipping a 6x-wrong number.

// A minimal year: 10 TWh gas + 10 TWh coal, nothing else. Round numbers so every
// expected value below is computable by hand from the published constants.
const GEN_MWH = 10_000_000; // 10 TWh
function baseRecord(overrides: Record<string, number> = {}): YearRecord {
  return {
    Year: 2050,
    "CO2_M$_MT": 50, // $50/ton carbon price
    Target_MWh: 2 * GEN_MWH,
    Outage_MWh: 0,
    "Outage_M$_MWh": 0,
    Iterations: 1,
    Gas_MWh: GEN_MWH,
    Coal_MWh: GEN_MWH,
    // Already-annual amortized fields, read straight through:
    "Gas_Capital_M$": 100,
    "Coal_Capital_M$": 200,
    "Gas_Fixed_M$": 40,
    "Coal_Fixed_M$": 60,
    ...overrides,
  } as unknown as YearRecord;
}

// Hand-computed from the published constants:
//   CO2  = 10e6*(Gas 4.5e-7 + Coal 8.63e-7) = 4.5 + 8.63 = 13.13 MT
const EXPECT_CO2_MT = 13.13;
//   variable = 10e6*(Gas 3.21883e-5 + Coal 2.328e-5) = 321.883 + 232.8 = 554.683 M$
const EXPECT_VARIABLE = 554.683;
//   co2 cost = 13.13 MT * $50/ton = 656.5 M$
const EXPECT_CO2_COST = 656.5;
//   capital = 100 + 200 = 300 ; fixed = 40 + 60 = 100 (pass-through)
const EXPECT_CAPITAL = 300;
const EXPECT_FIXED = 100;

test.describe("web-side CO2 accounting", () => {
  test("annual CO2 = per-year generation x intensity", () => {
    expect(co2MtFromGeneration(baseRecord())).toBeCloseTo(EXPECT_CO2_MT, 6);
  });

  test("CO2 is computed from generation, not the raw {s}_CO2_MT field", () => {
    // The original bug read {s}_CO2_MT, which the engine sums over sample_years
    // (~6) and never normalizes -- a ~6x over-report. Poison those fields with an
    // absurd value: if the number moves, the code is reading them again.
    const poisoned = baseRecord({
      Gas_CO2_MT: 9_000_000_000,
      Coal_CO2_MT: 9_000_000_000,
    });
    expect(co2MtFromGeneration(poisoned)).toBeCloseTo(EXPECT_CO2_MT, 6);
  });

  test("battery generation is counted, not silently dropped", () => {
    // Battery carries a small but nonzero CO2 intensity (embodied). A record with
    // battery output must add to the total, or the mix is under-counted.
    const withBattery = baseRecord({ Battery_MWh: GEN_MWH });
    expect(co2MtFromGeneration(withBattery)).toBeCloseTo(
      EXPECT_CO2_MT + GEN_MWH * CO2_INTENSITY.Battery,
      6
    );
  });
});

test.describe("web-side annual cost breakdown", () => {
  test("each component matches the hand-computed value", () => {
    const c = operatingCosts(baseRecord());
    expect(c.capital).toBeCloseTo(EXPECT_CAPITAL, 6);
    expect(c.fixed).toBeCloseTo(EXPECT_FIXED, 6);
    expect(c.variable).toBeCloseTo(EXPECT_VARIABLE, 6);
    expect(c.co2).toBeCloseTo(EXPECT_CO2_COST, 6);
  });

  test("variable and CO2 cost ignore the sample_years-inflated raw fields", () => {
    // Same regression guard as CO2 above, for the cost path: {s}_Variable_M$ and
    // {s}_CO2_M$ are summed over sample_years in the blob. operatingCosts must
    // recompute both from generation, so poisoning the raw fields changes nothing.
    const poisoned = baseRecord({
      "Gas_Variable_M$": 9_000_000_000,
      "Coal_Variable_M$": 9_000_000_000,
      "Gas_CO2_M$": 9_000_000_000,
      "Coal_CO2_M$": 9_000_000_000,
    });
    const c = operatingCosts(poisoned);
    expect(c.variable).toBeCloseTo(EXPECT_VARIABLE, 6);
    expect(c.co2).toBeCloseTo(EXPECT_CO2_COST, 6);
  });

  test("CO2 cost scales linearly with the per-year carbon price", () => {
    // co2 cost = annual CO2 (Mt) x price. At $0 it must be exactly 0 (a zero
    // carbon regime should cost nothing in CO2), and it must scale linearly.
    expect(operatingCosts(baseRecord({ "CO2_M$_MT": 0 })).co2).toBe(0);
    expect(operatingCosts(baseRecord({ "CO2_M$_MT": 100 })).co2).toBeCloseTo(
      EXPECT_CO2_COST * 2,
      6
    );
  });
});

test("the cost/CO2 constants cover exactly the six engine sources", () => {
  // deathsFromMwh, co2MtFromGeneration and operatingCosts all iterate SOURCES and
  // index these maps; a source added to the engine without a matching intensity/
  // variable-cost entry would silently contribute nothing. Keep them in lockstep.
  const sources = ["Solar", "Wind", "Nuclear", "Gas", "Coal", "Battery"];
  expect(Object.keys(CO2_INTENSITY).sort()).toEqual([...sources].sort());
  expect(Object.keys(VARIABLE_COST).sort()).toEqual([...sources].sort());
});
