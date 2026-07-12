"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REGIONS } from "@/lib/regions";
import { SOURCES, type SourceKey } from "@/lib/sources";
import {
  defaultScenarioConfig,
  type ScenarioConfigInput,
  type SourceTweaksInput,
  type TweakPairInput,
} from "@/lib/scenarioConfig";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-black";
const selectClass = inputClass;

export default function CustomRunPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ScenarioConfigInput>(defaultScenarioConfig());
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
        Configure a scenario and run it through the engine. Runs typically
        take about a minute; you&apos;ll be redirected to a status page once
        it&apos;s queued.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-10">
        <Section title="Scenario basics">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Region">
              <select
                className={selectClass}
                value={config.region}
                onChange={(e) => setConfig((c) => ({ ...c, region: e.target.value }))}
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

        <Section title="CO₂ price, interest, and demand">
          <div className="grid gap-4 sm:grid-cols-3">
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
        </Section>

        <Section title="Per-source tweaks">
          <div className="space-y-8">
            {SOURCES.map((s) => (
              <SourceTweaksFields
                key={s.key}
                label={s.label}
                value={config.sources[s.key]}
                onChange={(next) => updateSourceTweaks(s.key, next)}
              />
            ))}
          </div>
        </Section>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Starting run…" : "Run scenario"}
        </button>
      </form>
    </div>
  );
}

function TweakPairFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TweakPairInput;
  onChange: (patch: Partial<TweakPairInput>) => void;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <Field label="Initial">
          <input
            type="number"
            step="any"
            className={inputClass}
            value={value.initial}
            onChange={(e) => onChange({ initial: Number(e.target.value) })}
          />
        </Field>
        <Field label="Yearly">
          <input
            type="number"
            step="any"
            className={inputClass}
            value={value.yearly}
            onChange={(e) => onChange({ yearly: Number(e.target.value) })}
          />
        </Field>
      </div>
    </div>
  );
}

const SOURCE_TWEAK_FIELDS: { key: keyof SourceTweaksInput; label: string }[] = [
  { key: "capital", label: "Capital cost" },
  { key: "fixed", label: "Fixed cost" },
  { key: "variable", label: "Variable cost" },
  { key: "lifetime", label: "Lifetime" },
  { key: "max_pct", label: "Max %" },
];

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
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="font-medium">{label}</h3>
      <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {SOURCE_TWEAK_FIELDS.map(({ key, label: fieldLabel }) => (
          <TweakPairFields
            key={key}
            label={fieldLabel}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <span className="h-3 w-1 rounded-full bg-accent" aria-hidden />
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
