"use client";

import { useEffect, useMemo, useState } from "react";
import type { LibraryCaseSummary } from "@/lib/library";

function co2Key(c: LibraryCaseSummary): string {
  return `${c.co2_regime}|${c.co2_initial}|${c.co2_yearly}`;
}

function co2Label(c: LibraryCaseSummary): string {
  return c.co2_regime === "Increasing_CO2"
    ? `+$${c.co2_initial}/yr to $${c.co2_yearly} (increasing)`
    : `$${c.co2_initial}/MT (constant)`;
}

// text-base (16px) on mobile prevents iOS Safari from zooming the page when a
// select is focused; drop back to the denser text-sm from the sm breakpoint up.
const selectClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base sm:text-sm dark:border-zinc-700 dark:bg-black";

export function ScenarioPicker({
  cases,
  onChange,
}: {
  cases: LibraryCaseSummary[];
  onChange: (c: LibraryCaseSummary | null) => void;
}) {
  // Raw selections -- may be temporarily "stale" (pointing at a value
  // that no longer exists) right after an upstream dropdown changes.
  // Everything below derives a safe fallback at render time instead of
  // fixing it up in effects, so the UI is always consistent on the
  // very next render with no flicker.
  const [region, setRegion] = useState<string | undefined>();
  const [group, setGroup] = useState<string | undefined>();
  const [variant, setVariant] = useState<string | undefined>();
  const [co2, setCo2] = useState<string | undefined>();

  const regions = useMemo(
    () => Array.from(new Set(cases.map((c) => c.region))).sort(),
    [cases]
  );
  const effectiveRegion = region && regions.includes(region) ? region : regions[0];

  const groups = useMemo(() => {
    const set = new Set(
      cases.filter((c) => c.region === effectiveRegion).map((c) => c.group_name)
    );
    return Array.from(set).sort((a, b) =>
      a === "Default" ? -1 : b === "Default" ? 1 : a.localeCompare(b)
    );
  }, [cases, effectiveRegion]);
  const effectiveGroup = group && groups.includes(group) ? group : groups[0];

  const variants = useMemo(() => {
    const set = new Set(
      cases
        .filter((c) => c.region === effectiveRegion && c.group_name === effectiveGroup)
        .map((c) => c.variant)
    );
    return Array.from(set).sort();
  }, [cases, effectiveRegion, effectiveGroup]);
  const effectiveVariant = variant && variants.includes(variant) ? variant : variants[0];

  const co2Options = useMemo(
    () =>
      cases.filter(
        (c) =>
          c.region === effectiveRegion &&
          c.group_name === effectiveGroup &&
          c.variant === effectiveVariant
      ),
    [cases, effectiveRegion, effectiveGroup, effectiveVariant]
  );
  const effectiveCo2 = co2Options.find((c) => co2Key(c) === co2) ?? co2Options[0];

  useEffect(() => {
    onChange(effectiveCo2 ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCo2?.case_id]);

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Field label="Region">
        <select
          className={selectClass}
          value={effectiveRegion ?? ""}
          onChange={(e) => setRegion(e.target.value)}
        >
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Scenario group">
        <select
          className={selectClass}
          value={effectiveGroup ?? ""}
          onChange={(e) => setGroup(e.target.value)}
        >
          {groups.map((g) => (
            <option key={g} value={g}>
              {g.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Variant">
        <select
          className={selectClass}
          value={effectiveVariant ?? ""}
          onChange={(e) => setVariant(e.target.value)}
          disabled={variants.length <= 1}
        >
          {variants.map((v) => (
            <option key={v} value={v}>
              {v.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </Field>

      <Field label="CO₂ price">
        <select
          className={selectClass}
          value={effectiveCo2 ? co2Key(effectiveCo2) : ""}
          onChange={(e) => setCo2(e.target.value)}
        >
          {co2Options.map((c) => (
            <option key={co2Key(c)} value={co2Key(c)}>
              {co2Label(c)}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
