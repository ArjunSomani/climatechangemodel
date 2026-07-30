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
  // Mortality externality price. `initial` is $ per death; `yearly` is a
  // multiplicative VSL escalation applied each year after the first (1.0 =
  // flat). Mirrors the engine's mortality_price. Default 0 -> reported but
  // does not change what gets built.
  mortality_price: TweakPairInput;
  sources: Record<SourceKey, SourceTweaksInput>;
}

// ---------------------------------------------------------------------------
// Draft types: the shape the custom-run FORM holds, as distinct from the shape
// that goes over the wire.
//
// A numeric field being empty is a real state and it is not the same state as
// zero. Conflating them (`Number(e.target.value)` returns 0 for "") meant a
// cleared capital-cost box submitted as a 0x multiplier -- valid to the
// validator, free power plants to the engine, silent to the user. The draft
// carries `null` for empty so the form can refuse to submit and say which field.
export type TweakPairDraft = {
  initial: number | null;
  yearly: number | null;
};

export type SourceTweaksDraft = Record<keyof SourceTweaksInput, TweakPairDraft>;

export interface ScenarioDraft {
  region: string;
  years: number | null;
  co2_price: TweakPairDraft;
  interest: TweakPairDraft;
  demand: TweakPairDraft;
  // Slider- and preset-driven only, never free text, so it cannot be empty.
  mortality_price: TweakPairInput;
  sources: Record<SourceKey, SourceTweaksDraft>;
}

const TWEAK_PAIR_LABELS: Record<string, string> = {
  co2_price: "CO\u2082 price",
  interest: "Interest rate",
  demand: "Demand growth",
};

// Collects EVERY empty/invalid field rather than stopping at the first, so the
// user gets one complete list instead of fixing them one submit at a time.
export function draftIssues(draft: ScenarioDraft): string[] {
  const issues: string[] = [];

  if (draft.years === null) issues.push("Years");

  for (const field of ["co2_price", "interest", "demand"] as const) {
    const pair = draft[field];
    const name = TWEAK_PAIR_LABELS[field];
    if (pair.initial === null) issues.push(`${name} (initial)`);
    if (pair.yearly === null) issues.push(`${name} (yearly)`);
  }

  for (const s of SOURCES) {
    const tweaks = draft.sources[s.key];
    for (const key of Object.keys(tweaks) as (keyof SourceTweaksInput)[]) {
      const pair = tweaks[key];
      if (pair.initial === null) issues.push(`${s.label} ${key} (initial)`);
      if (pair.yearly === null) issues.push(`${s.label} ${key} (yearly)`);
    }
  }

  return issues;
}

// Narrows a draft to the wire type. Returns null when anything is still empty --
// callers should use draftIssues() to tell the user what.
export function draftToConfig(draft: ScenarioDraft): ScenarioConfigInput | null {
  if (draftIssues(draft).length > 0) return null;
  return draft as ScenarioConfigInput;
}

// The form's starting draft. Same numbers as defaultScenarioConfig, widened.
export function defaultScenarioDraft(): ScenarioDraft {
  return defaultScenarioConfig() as ScenarioDraft;
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
    mortality_price: defaultTweakPair(0, 1),
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

  // Object.hasOwn, not `in`: `"constructor" in REGIONS` is true via the
  // prototype chain, so `in` accepted "constructor", "toString", "valueOf" and
  // friends as region codes -- exactly the "bad input crashes run_worker.py"
  // case this check exists to prevent.
  if (typeof c.region !== "string" || !Object.hasOwn(REGIONS, c.region))
    return null;
  if (!isFiniteNumber(c.years) || c.years <= 0 || c.years > 50) return null;
  if (!isValidTweakPair(c.co2_price)) return null;
  if (!isValidTweakPair(c.interest)) return null;
  if (!isValidTweakPair(c.demand)) return null;

  // mortality_price is optional for backward compatibility: a config without
  // it (older saved scenarios, library cases) is treated as a zero,
  // no-escalation price, matching the engine's default. When present it must
  // be a valid pair.
  let mortalityPrice: TweakPairInput = { initial: 0, yearly: 1 };
  if (c.mortality_price !== undefined) {
    if (!isValidTweakPair(c.mortality_price)) return null;
    mortalityPrice = c.mortality_price as TweakPairInput;
  }

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
    mortality_price: mortalityPrice,
    sources: sources as Record<SourceKey, SourceTweaksInput>,
  };
}

// Marks a downloaded scenario file so a re-imported one is recognizable at a
// glance (and so we can grow the format later behind `version`). The config
// itself is nested under `config`, which is also exactly the shape the
// results export (custom-run-*.json = { config, result }) already uses -- so
// both files load back into the form through parseScenarioConfigFile below.
export const SCENARIO_CONFIG_FILE_TYPE = "optimize-scenario-config";

export function serializeScenarioConfig(config: ScenarioConfigInput): string {
  return JSON.stringify(
    { type: SCENARIO_CONFIG_FILE_TYPE, version: 1, config },
    null,
    2
  );
}

// Reads a saved scenario back from file text. Accepts three shapes so users
// can reload anything the app hands them: a bare ScenarioConfig, our own
// saved wrapper ({ type, version, config }), or the results export
// ({ config, result }). Returns null on malformed JSON or a config that
// fails validation, so the caller can show one "couldn't read that file"
// message for every failure mode.
export function parseScenarioConfigFile(text: string): ScenarioConfigInput | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const direct = validateScenarioConfig(parsed);
  if (direct) return direct;

  if (typeof parsed === "object" && parsed !== null && "config" in parsed) {
    return validateScenarioConfig((parsed as { config: unknown }).config);
  }

  return null;
}
