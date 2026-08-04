"use client";

import { Term } from "@/components/Term";
import type { TweakPairInput } from "@/lib/scenarioConfig";
import {
  VSL_ESCALATION_YEARLY,
  VSL_MAX,
  VSL_MIN,
  VSL_PRESETS,
  VSL_STEP,
  formatVsl,
} from "@/lib/mortality";

// Mortality price control for the custom-run form: a $/death slider with the
// three HHS VSL presets marked, plus the real-terms VSL escalation toggle.
// Sits adjacent to the carbon price -- the two are the same kind of object.
export function MortalityPriceControl({
  value,
  onChange,
}: {
  value: TweakPairInput;
  onChange: (next: TweakPairInput) => void;
}) {
  const price = value.initial;
  const escalating = value.yearly > 1;

  function setPrice(initial: number) {
    onChange({ ...value, initial });
  }
  function setEscalating(on: boolean) {
    onChange({ ...value, yearly: on ? VSL_ESCALATION_YEARLY : 1 });
  }

  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <span className="h-3 w-1 rounded-full bg-accent" aria-hidden />
        Mortality price
      </h2>

      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        What the model assumes society is willing to pay to prevent one death.
        Set to zero, deaths are reported but don&apos;t change what gets built.
      </p>

      <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-baseline justify-between">
          <label htmlFor="mortality-price" className="text-sm font-medium">
            Price per death
          </label>
          <span className="font-mono text-lg tabular-nums">
            {formatVsl(price)}
          </span>
        </div>

        <input
          id="mortality-price"
          type="range"
          min={VSL_MIN}
          max={VSL_MAX}
          step={VSL_STEP}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="mt-3 w-full accent-[var(--accent)]"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <PresetButton
            value="$0"
            tier="off"
            active={price === 0}
            onClick={() => setPrice(0)}
          />
          {VSL_PRESETS.map((p) => (
            <PresetButton
              key={p.label}
              value={formatVsl(p.value)}
              tier={p.label}
              active={price === p.value}
              onClick={() => setPrice(p.value)}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Presets are HHS&apos;s 2026 published{" "}
          <Term definition="Value of a Statistical Life: the dollar figure at which a large population's willingness to pay to reduce risk implies one avoided death. It is a statistical aggregate, not a valuation of any specific person.">
            VSL
          </Term>{" "}
          range (constant 2025 dollars): a range, not a recommended figure.
        </p>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={escalating}
            onChange={(e) => setEscalating(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            Escalate VSL in real terms (~1.1%/yr) over the horizon.{" "}
            <span className="text-zinc-500 dark:text-zinc-400">
              Holding it flat for 25 years is itself an assumption.
            </span>
          </span>
        </label>
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Assigning a dollar value to a death is a moral choice you are making,
        not a technical parameter the model resolves for you.
      </p>
    </section>
  );
}

function PresetButton({
  value,
  tier,
  active,
  onClick,
}: {
  value: string;
  tier: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex min-w-16 flex-col items-center rounded-md border px-3 py-1.5 transition-colors " +
        (active
          ? "border-accent text-accent"
          : "border-zinc-300 text-zinc-600 hover:border-accent dark:border-zinc-700 dark:text-zinc-300")
      }
    >
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-zinc-400">
        {tier}
      </span>
    </button>
  );
}
