export function formatEnergy(mwh: number): string {
  const abs = Math.abs(mwh);
  if (abs >= 1_000_000) return `${(mwh / 1_000_000).toFixed(1)} TWh`;
  if (abs >= 1_000) return `${(mwh / 1_000).toFixed(1)} GWh`;
  return `${mwh.toFixed(0)} MWh`;
}

export interface EnergyUnit {
  unit: "TWh" | "GWh" | "MWh";
  divisor: number;
}

// Pick ONE unit for a whole axis/series from its largest value, rather than
// letting each tick pick its own (e.g. an axis must never mix "255.0 TWh"
// and "0 MWh" -- same axis, same unit, always).
export function pickEnergyUnit(maxMwh: number): EnergyUnit {
  const abs = Math.abs(maxMwh);
  if (abs >= 1_000_000) return { unit: "TWh", divisor: 1_000_000 };
  if (abs >= 1_000) return { unit: "GWh", divisor: 1_000 };
  return { unit: "MWh", divisor: 1 };
}

export function formatEnergyIn(mwh: number, { unit, divisor }: EnergyUnit): string {
  const scaled = mwh / divisor;
  return `${scaled.toFixed(scaled < 10 ? 1 : 0)} ${unit}`;
}

export interface PowerUnit {
  unit: "TW" | "GW" | "MW";
  divisor: number;
}

// Power (capacity) in MW, same one-unit-per-axis rule as energy.
export function pickPowerUnit(maxMw: number): PowerUnit {
  const abs = Math.abs(maxMw);
  if (abs >= 1_000_000) return { unit: "TW", divisor: 1_000_000 };
  if (abs >= 1_000) return { unit: "GW", divisor: 1_000 };
  return { unit: "MW", divisor: 1 };
}

export function formatPowerIn(mw: number, { unit, divisor }: PowerUnit): string {
  const scaled = mw / divisor;
  return `${scaled.toFixed(scaled < 10 ? 1 : 0)} ${unit}`;
}

export function formatMoney(millions: number): string {
  const abs = Math.abs(millions);
  if (abs >= 1_000) return `$${(millions / 1_000).toFixed(1)}B`;
  return `$${millions.toFixed(1)}M`;
}

export function formatCO2(mt: number): string {
  return `${mt.toFixed(1)} MT`;
}
