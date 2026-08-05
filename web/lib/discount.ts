// Present value of a harm-cost stream at a discount rate applied to HARMS --
// deliberately separate from the interest rate the engine already applies to
// capital. The engine discounts the cost of building the grid (npf.pmt
// amortization) but weights a death in 2050 exactly like one today. Whether that
// is right is a value judgment, not a modeling fact, so this exposes it: pick a
// rate and see the present value of the priced harms change.
//
// It surfaces a real asymmetry. Air-pollution deaths happen now and locally; the
// damage from a ton of CO2 plays out later and globally. Applying the same rate
// to both streams reweights them differently, which is exactly why reasonable
// people who agree on the physics still weight the two harms differently.
import { computeYearDeaths } from "@/lib/mortality";
import { operatingCosts } from "@/lib/costs";
import type { YearRecord } from "@/lib/library";

// Present value of a per-year stream, first modeled year taken as the present
// (t=0, undiscounted) and each subsequent year discounted by (1+rate)^-t.
export function presentValue(perYear: number[], rate: number): number {
  let pv = 0;
  for (let t = 0; t < perYear.length; t++) {
    pv += perYear[t] / Math.pow(1 + rate, t);
  }
  return pv;
}

export interface HarmStreams {
  mortalityCostPerYear: number[]; // $ per year (deaths x VSL); empty of value if unpriced
  co2CostPerYear: number[]; // $ per year (carbon price x emissions)
  hasMortalityPrice: boolean;
  hasCarbonPrice: boolean;
}

// Build the two priced-harm streams from a scenario's year records plus the VSL
// it was run at. Mortality cost is the central death count times the VSL; CO2
// cost is the carbon-price component already computed for the cost breakdown
// (operatingCosts returns M$, so scale to $). A stream is all zeros when its
// price was zero -- reported honestly rather than hidden.
export function harmCostStreams(
  records: YearRecord[],
  vsl: number
): HarmStreams {
  const mortalityCostPerYear: number[] = [];
  const co2CostPerYear: number[] = [];
  let anyCarbon = false;

  for (const r of records) {
    const deaths = computeYearDeaths(r).central;
    mortalityCostPerYear.push(deaths * vsl);
    const co2CostM = operatingCosts(r).co2; // M$
    if (co2CostM > 0) anyCarbon = true;
    co2CostPerYear.push(co2CostM * 1_000_000); // -> $
  }

  return {
    mortalityCostPerYear,
    co2CostPerYear,
    hasMortalityPrice: vsl > 0,
    hasCarbonPrice: anyCarbon,
  };
}
