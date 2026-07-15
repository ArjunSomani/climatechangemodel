// Mirrors engine/optimize_engine/schemas.py's ScenarioConfig exactly --
// field names and nesting must match 1:1 since this JSON is passed
// straight through to ScenarioConfig(**config_dict) in run_worker.py.
import { SOURCES, type SourceKey } from "@/lib/sources";
import { REGIONS } from "@/lib/regions";

export interface TweakPairInput {
  initial: number;
  yearly: number;
}

export interface SourceTweaksInput {
  capital: TweakPairInput;
  fixed: TweakPairInput;
  variable: TweakPairInput;
  lifetime: TweakPairInput;
  max_pct: TweakPairInput;
}

export interface ScenarioConfigInput {
  region: string;
  years: number;
  co2_price: TweakPairInput;
  interest: TweakPairInput;
  demand: TweakPairInput;
  sources: Record<SourceKey, SourceTweaksInput>;
}

export function defaultTweakPair(initial: number, yearly = 1): TweakPairInput {
  return { initial, yearly };
}

export function defaultSourceTweaks(): SourceTweaksInput {
  return {
    capital: defaultTweakPair(1),
    fixed: defaultTweakPair(1),
    variable: defaultTweakPair(1),
    lifetime: defaultTweakPair(1),
    max_pct: defaultTweakPair(1),
  };
}

export function defaultScenarioConfig(): ScenarioConfigInput {
  return {
    region: "CAL",
    years: 25,
    co2_price: defaultTweakPair(0, 0),
    interest: defaultTweakPair(0.12),
    demand: defaultTweakPair(1.02),
    sources: Object.fromEntries(
      SOURCES.map((s) => [s.key, defaultSourceTweaks()])
    ) as Record<SourceKey, SourceTweaksInput>,
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidTweakPair(v: unknown): v is TweakPairInput {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return isFiniteNumber(t.initial) && isFiniteNumber(t.yearly);
}

function isValidSourceTweaks(v: unknown): v is SourceTweaksInput {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    isValidTweakPair(t.capital) &&
    isValidTweakPair(t.fixed) &&
    isValidTweakPair(t.variable) &&
    isValidTweakPair(t.lifetime) &&
    isValidTweakPair(t.max_pct)
  );
}

// Mirrors ScenarioConfig's own constraints (schemas.py: years Field(gt=0, le=50))
// plus a region check against the known region list, so bad input is
// rejected here with a 400 rather than crashing run_worker.py.
export function validateScenarioConfig(v: unknown): ScenarioConfigInput | null {
  if (typeof v !== "object" || v === null) return null;
  const c = v as Record<string, unknown>;

  if (typeof c.region !== "string" || !(c.region in REGIONS)) return null;
  if (!isFiniteNumber(c.years) || c.years <= 0 || c.years > 50) return null;
  if (!isValidTweakPair(c.co2_price)) return null;
  if (!isValidTweakPair(c.interest)) return null;
  if (!isValidTweakPair(c.demand)) return null;

  if (typeof c.sources !== "object" || c.sources === null) return null;
  const sources = c.sources as Record<string, unknown>;
  for (const s of SOURCES) {
    if (!isValidSourceTweaks(sources[s.key])) return null;
  }

  return {
    region: c.region,
    years: c.years,
    co2_price: c.co2_price as TweakPairInput,
    interest: c.interest as TweakPairInput,
    demand: c.demand as TweakPairInput,
    sources: sources as Record<SourceKey, SourceTweaksInput>,
  };
}
