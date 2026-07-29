"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REGIONS } from "@/lib/regions";
import { regionDemandGrowth, regionDemandMultiplier } from "@/lib/regionDemand";
import { SOURCES, type SourceKey } from "@/lib/sources";
import { ConfigSaveLoad } from "@/components/ConfigSaveLoad";
import { MortalityPriceControl } from "@/components/MortalityPriceControl";
import {
  defaultScenarioConfig,
  type ScenarioConfigInput,
  type SourceTweaksInput,
  type TweakPairInput,
} from "@/lib/scenarioConfig";

// text-base (16px) on mobile prevents iOS Safari from zooming the page when a
// field is focused; drop back to the denser text-sm from the sm breakpoint up.
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base sm:text-sm dark:border-zinc-700 dark:bg-black";
const selectClass = inputClass;

function Icon({
  path,
  className,
}: {
  path: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {path}
    </svg>
  );
}

const ICON_MAP = Object.freeze({
  map: (
    <>
      <path d="M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 5.5 9 3Z" />
      <path d="M9 3v15M15 5.5v15" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1" />
      <circle cx="13" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  tune: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v6M16 4v3" />
    </>
  ),
});

const PRESETS: Preset[] = [
  {
    label: "No carbon price",
    blurb: "Today's rules — CO₂ pollution is free.",
    apply: (c) => ({ ...c, co2_price: { initial: 0, yearly: 0 } }),
  },
  {
    label: "$100/ton carbon price",
    blurb: "A flat, moderate price on carbon pollution.",
    apply: (c) => ({ ...c, co2_price: { initial: 100, yearly: 0 } }),
  },
  {
    label: "Rising carbon price",
    blurb: "Starts at $50/ton, climbs $10 every year.",
    apply: (c) => ({ ...c, co2_price: { initial: 50, yearly: 10 } }),
  },
];

// The headline comparison: coal exits under either price, but gas is where
// they disagree. A mortality-only price tolerates gas (gas is ~9x cleaner than
// coal on deaths); a carbon-only price at comparable stringency pushes past it
// (gas is only ~1.7x cleaner on CO2). Flip between these to see it move.
const COMPARISON_PRESETS: Preset[] = [
  {
    label: "Carbon price only",
    blurb: "$400/ton CO₂, no mortality price.",
    apply: (c) => ({
      ...c,
      co2_price: { initial: 400, yearly: 0 },
      mortality_price: { initial: 0, yearly: 1 },
    }),
  },
  {
    label: "Mortality price only",
    blurb: "$14.1M/death (central VSL), no carbon price.",
    apply: (c) => ({
      ...c,
      co2_price: { initial: 0, yearly: 0 },
      mortality_price: { initial: 14_100_000, yearly: 1 },
    }),
  },
  {
    label: "Both prices",
    blurb: "$400/ton CO₂ and $14.1M/death together.",
    apply: (c) => ({
      ...c,
      co2_price: { initial: 400, yearly: 0 },
      mortality_price: { initial: 14_100_000, yearly: 1 },
    }),
  },
];

export default function CustomRunPage() {
  const router = useRouter();
  // Demand growth defaults to the selected region's own historical rate rather
  // than one US-wide number; changing region re-applies its default (overridable).
  const [config, setConfig] = useState<ScenarioConfigInput>(() => {
    const c = defaultScenarioConfig();
    return {
      ...c,
      demand: { ...c.demand, initial: regionDemandMultiplier(c.region) },
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateTweakPair(
    field: "co2_price" | "interest" | "demand",
    patch: Partial<TweakPairInput>
  ) {
    setConfig((c) => ({ ...c, [field]: { ...c[field], ...patch } }));
  }

  function updateSourceTweaks(source: SourceKey, next: SourceTweaksInput) {
    setConfig((c) => ({ ...c, sources: { ...c.sources, [source]: next } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to start run");
        setSubmitting(false);
        return;
      }
      router.push(`/custom-run/${body.runId}`);
    } catch {
      setError("Failed to start run");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Custom run</h1>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        Configure a scenario and run it through the engine. A worker picks
        the run off the queue within a few minutes, then it computes in about
        a minute; you&apos;ll be redirected to a live status page to watch it.
      </p>

      {/* Both preset groups used to sit inside their own bordered box, so every
          preset was a bordered card nested in a bordered card. The buttons need
          the border -- it's the affordance -- so the outer box is what goes; a
          heading and space do its grouping job without the second frame. */}
      <PresetGroup
        heading="Not sure where to start? Try a preset:"
        presets={PRESETS}
        onPick={(apply) => setConfig(apply)}
      />

      <PresetGroup
        heading="Or compare pricing carbon vs. mortality:"
        note="Coal exits under either. Gas is where they disagree — flip between these and watch the gas build move."
        presets={COMPARISON_PRESETS}
        onPick={(apply) => setConfig(apply)}
      />

      <div className="mt-6 flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Save this scenario to reuse or share it — or load one you saved
          earlier.
        </p>
        <ConfigSaveLoad config={config} onLoad={setConfig} />
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-10">
        <Section title="Scenario basics" icon="map">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Region">
              <select
                className={selectClass}
                value={config.region}
                onChange={(e) => {
                  const region = e.target.value;
                  setConfig((c) => ({
                    ...c,
                    region,
                    demand: {
                      ...c.demand,
                      initial: regionDemandMultiplier(region),
                    },
                  }));
                }}
              >
                {Object.entries(REGIONS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Years">
              <input
                type="number"
                min={1}
                max={50}
                className={inputClass}
                value={config.years}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, years: Number(e.target.value) }))
                }
              />
            </Field>
          </div>
        </Section>

        <Section title="CO₂ price, interest, and demand" icon="sliders">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Each knob has an <strong>initial</strong> value (year 0) and a{" "}
            <strong>yearly</strong> change applied every year after that.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <TweakPairFields
              label="CO₂ price ($/MT)"
              value={config.co2_price}
              onChange={(patch) => updateTweakPair("co2_price", patch)}
            />
            <TweakPairFields
              label="Interest rate"
              value={config.interest}
              onChange={(patch) => updateTweakPair("interest", patch)}
            />
            <TweakPairFields
              label="Demand growth"
              value={config.demand}
              onChange={(patch) => updateTweakPair("demand", patch)}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Demand growth defaults to {config.region}&apos;s historical average
            (~{(regionDemandGrowth(config.region) * 100).toFixed(1)}%/yr, an
            initial multiplier of {regionDemandMultiplier(config.region).toFixed(3)}).
            Each region carries its own; change the initial value above to
            override.
          </p>
        </Section>

        <MortalityPriceControl
          value={config.mortality_price}
          onChange={(next) => setConfig((c) => ({ ...c, mortality_price: next }))}
        />

        <details className="group rounded-lg border border-zinc-200 dark:border-zinc-800">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-lg font-medium marker:content-none">
            <Icon
              path={ICON_MAP.tune}
              className="h-4 w-4 text-accent"
            />
            Advanced: per-source cost assumptions
            <span className="ml-auto text-xs font-normal text-zinc-500 transition group-open:rotate-180 dark:text-zinc-400">
              ▾
            </span>
          </summary>
          <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              The defaults here are real-world cost figures — capital cost to
              build, fixed and variable costs to run, plant lifetime, and the
              maximum share of the grid a source can grow to in a year. Leave
              these alone unless you want to test a specific assumption (e.g.
              &ldquo;what if nuclear were 30% cheaper to build?&rdquo;).
            </p>
            <div className="mt-4 space-y-8">
              {SOURCES.map((s) => (
                <SourceTweaksFields
                  key={s.key}
                  label={s.label}
                  value={config.sources[s.key]}
                  onChange={(next) => updateSourceTweaks(s.key, next)}
                />
              ))}
            </div>
          </div>
        </details>

        {/* Submitting is an async POST with no page change on failure, so the
            error has to be announced, not just rendered. role=alert on a
            container that's always present (rather than mounting the <p>
            itself) is what makes assistive tech read it -- a live region added
            to the DOM at the same moment as its content is often missed. */}
        <div role="alert" aria-atomic="true">
          {error && (
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* text-accent-foreground, not text-white: the shared token is the one
            measured against --accent in both themes (4.81:1 light). Plain white
            on the light accent was 4.47:1 and on the dark accent 2.79:1.
            No opacity in the disabled state -- the disabled label IS the status
            message ("Starting run…"), and any opacity below 1 composites it
            toward the page background: 0.8 measured 3.45:1 in light. The
            pending state reads instead from the text swap, aria-busy, and the
            cursor. */}
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="min-h-11 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground disabled:cursor-progress"
        >
          {submitting ? "Starting run…" : "Run scenario"}
        </button>
      </form>
    </div>
  );
}

// Every knob on this page is an initial/yearly pair, and this form renders 33
// of them (3 top-level + 6 sources x 5 fields). Naming the inputs from their
// visible "Initial"/"Yearly" captions alone left 33 spinbuttons called
// "Initial" and 33 called "Yearly" -- a screen-reader user could hear the whole
// form and never learn which knob they were editing. The group's own label
// (e.g. "CO2 price ($/MT)") has to reach the input, so:
//   - fieldset/legend puts it in the accessibility tree as a real grouping, and
//   - aria-label composes the full name on each input, because a legend alone
//     is announced on entering the group, not re-announced per field.
// `group` is the caller's disambiguator when the same field label repeats
// across sources ("Capital cost" under Solar vs under Coal).
type Preset = {
  label: string;
  blurb: string;
  apply: (c: ScenarioConfigInput) => ScenarioConfigInput;
};

function PresetGroup({
  heading,
  note,
  presets,
  onPick,
}: {
  heading: string;
  note?: string;
  presets: Preset[];
  onPick: (apply: (c: ScenarioConfigInput) => ScenarioConfigInput) => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">
        {heading}
      </h2>
      {note && (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{note}</p>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onPick(p.apply)}
            className="rounded-lg border border-zinc-200 p-3 text-left text-sm hover:border-accent dark:border-zinc-800"
          >
            <span className="block font-medium text-black dark:text-zinc-50">
              {p.label}
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              {p.blurb}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TweakPairFields({
  label,
  group,
  value,
  onChange,
}: {
  label: string;
  group?: string;
  value: TweakPairInput;
  onChange: (patch: Partial<TweakPairInput>) => void;
}) {
  const qualified = group ? `${group} — ${label}` : label;
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </legend>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <Field label="Initial">
          <input
            type="number"
            step="any"
            aria-label={`${qualified}, initial value`}
            className={inputClass}
            value={value.initial}
            onChange={(e) => onChange({ initial: Number(e.target.value) })}
          />
        </Field>
        <Field label="Yearly">
          <input
            type="number"
            step="any"
            aria-label={`${qualified}, yearly change`}
            className={inputClass}
            value={value.yearly}
            onChange={(e) => onChange({ yearly: Number(e.target.value) })}
          />
        </Field>
      </div>
    </fieldset>
  );
}

const SOURCE_TWEAK_FIELDS: { key: keyof SourceTweaksInput; label: string }[] = [
  { key: "capital", label: "Capital cost" },
  { key: "fixed", label: "Fixed cost" },
  { key: "variable", label: "Variable cost" },
  { key: "lifetime", label: "Lifetime" },
  { key: "max_pct", label: "Max %" },
];

// No border on the wrapper: this sits inside the already-bordered <details>
// panel, so a bordered card per source was a card inside a card. A hairline rule
// between sources and the source name carry the grouping instead.
function SourceTweaksFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SourceTweaksInput;
  onChange: (next: SourceTweaksInput) => void;
}) {
  return (
    <div className="border-t border-zinc-200 pt-5 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <h3 className="font-medium">{label}</h3>
      <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {SOURCE_TWEAK_FIELDS.map(({ key, label: fieldLabel }) => (
          <TweakPairFields
            key={key}
            label={fieldLabel}
            group={label}
            value={value[key]}
            onChange={(patch) =>
              onChange({ ...value, [key]: { ...value[key], ...patch } })
            }
          />
        ))}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof ICON_MAP;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <Icon
          path={ICON_MAP[icon]}
          className="h-4 w-4 text-accent"
        />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
