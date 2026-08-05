// Land-use footprint for the two sources where land is a real siting constraint,
// with the distinction the review asked for: TOTAL enclosed area vs the land
// ACTUALLY occupied. Wind's total (turbine spacing) is large, but only ~3% is
// physically used -- the rest stays farmland or rangeland -- so reporting a
// single wind land number overstates its footprint by ~100x.
//
// Units: km2 per TWh/yr of generation, converted to one basis so the two are
// comparable. Sources are the canonical NREL studies:
//   Solar: Ong et al. (2013), Land-Use Requirements for Solar Power Plants in
//          the United States, NREL/TP-6A2-56290 -- 3.6 (total) / 3.1 (direct)
//          acres/GWh/yr for fixed-tilt PV, converted at 0.00404686 km2/acre.
//   Wind:  Denholm et al. (2009), Land-Use Requirements of Modern Wind Power
//          Plants, NREL/TP-6A2-45834 -- 126.9 (total/spacing) / 1.3 (direct)
//          km2/TWh.
//
// Thermal plants (coal, gas, nuclear) are deliberately omitted: their on-site
// footprint is small, but their land use is dominated by the off-site fuel cycle
// (surface mining, drilling), which has no single well-sourced generation-based
// factor -- so a number here would be more misleading than illuminating.

export interface LandRow {
  key: string;
  label: string;
  total: number; // km2 per TWh/yr, all land enclosed by the site boundary
  exclusive: number; // km2 per TWh/yr, land physically occupied
  colorVar: string;
  source: string;
  note: string;
}

export const LAND: LandRow[] = [
  {
    key: "Solar",
    label: "Solar (PV)",
    total: 14.6, // 3.6 acres/GWh/yr
    exclusive: 12.5, // 3.1 acres/GWh/yr
    colorVar: "--series-solar",
    source: "Ong et al. 2013 (NREL/TP-6A2-56290)",
    note: "Fixed-tilt utility PV. Panels cover most of the enclosed site, so total and occupied area are close.",
  },
  {
    key: "Wind",
    label: "Wind",
    total: 126.9,
    exclusive: 1.3,
    colorVar: "--series-wind",
    source: "Denholm et al. 2009 (NREL/TP-6A2-45834)",
    note: "Turbine spacing makes the enclosed area large, but pads, roads and substations occupy only ~1%; the rest stays farmable.",
  },
];

// The multiple by which reporting a source's TOTAL area overstates the land it
// actually occupies -- the headline for wind (~100x).
export function overstatementFactor(row: LandRow): number {
  return row.exclusive > 0 ? row.total / row.exclusive : Infinity;
}
