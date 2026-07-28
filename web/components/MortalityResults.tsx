"use client";

import type { YearRecord } from "@/lib/library";
import type { ScenarioConfigInput } from "@/lib/scenarioConfig";
import { DeathsTrajectoryChart } from "@/components/DeathsTrajectoryChart";
import { UncertaintyBandNote } from "@/components/SafetyDisclosure";
import { SOURCES } from "@/lib/sources";
import {
  computeScenarioDeaths,
  levelSourceUrl,
  MORTALITY,
  ENGINE_SOURCE_TO_MORTALITY_KEY,
  formatVsl,
} from "@/lib/mortality";

function fmt(n: number): string {
  if (n === 0) return "0";
  if (n < 10) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return Math.round(n).toLocaleString();
}

// Hatched fill = modeled deaths (pollution/radiation attributions); solid =
// counted deaths (recorded accidents). Same encoding Level uses; the
// distinction is not decoration.
const HATCH =
  "repeating-linear-gradient(45deg, var(--accent) 0 3px, transparent 3px 6px)";

export function MortalityResults({
  result,
  config,
}: {
  result: YearRecord[];
  config: ScenarioConfigInput | null;
}) {
  const deaths = computeScenarioDeaths(result);
  const price = config?.mortality_price?.initial ?? 0;
  const priced = price > 0;

  const counted = deaths.cumulativeCounted;
  const modeled = deaths.cumulativeModeled;
  const split = counted + modeled;
  const countedPct = split > 0 ? (100 * counted) / split : 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {priced ? (
          <>
            At <span className="font-medium">{formatVsl(price)}</span> per death,
            this is the grid that would be cheapest{" "}
            <em>if that price were the true cost of a death</em> — a framing, not
            a recommendation.
          </>
        ) : (
          <>
            Mortality is <span className="font-medium">reported but not priced</span>{" "}
            here — the mortality price was zero, so these deaths did not change
            what got built.
          </>
        )}
      </p>

      {/* Cumulative deaths as a band */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Cumulative deaths over the horizon
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">
            {fmt(deaths.cumulativeCentral)}
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            central · band {fmt(deaths.cumulativeLow)}–{fmt(deaths.cumulativeHigh)}
          </span>
        </div>

        {/* Counted vs modeled split, solid vs hatched */}
        <div className="mt-4">
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-accent/40">
            <div
              className="h-full bg-accent"
              style={{ width: `${countedPct}%` }}
              aria-hidden
            />
            <div
              className="h-full"
              style={{ width: `${100 - countedPct}%`, backgroundImage: HATCH }}
              aria-hidden
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" />
              Counted (accidents): {fmt(counted)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm border border-accent/40"
                style={{ backgroundImage: HATCH }}
              />
              Modeled (pollution/radiation): {fmt(modeled)}
            </span>
          </div>
        </div>
      </div>

      <UncertaintyBandNote />

      {/* Annual deaths over time, as a band */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Deaths per year (uncertainty band)
        </div>
        <DeathsTrajectoryChart result={result} />
      </div>

      {/* Deaths per TWh, comparable to Level's risk rule */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Deaths per TWh of the resulting mix
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {fmt(deaths.deathsPerTwhCentral)}
          <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
            deaths/TWh (central)
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Directly comparable to{" "}
          <a
            href="https://levelmodel.vercel.app"
            className="underline hover:text-accent"
            target="_blank"
            rel="noreferrer"
          >
            Level&apos;s risk rule
          </a>
          , the descriptive source for these coefficients.
        </p>
      </div>

      {/* Per-source coefficients, each linked back to Level */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 text-right font-medium">deaths/TWh</th>
              <th className="px-3 py-2 text-right font-medium">Modeled</th>
              <th className="px-3 py-2 text-right font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => {
              const key = ENGINE_SOURCE_TO_MORTALITY_KEY[s.key];
              if (key === null) {
                return (
                  <tr
                    key={s.key}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50"
                  >
                    <td className="px-3 py-2">{s.label}</td>
                    <td
                      className="px-3 py-2 text-right text-zinc-400"
                      colSpan={3}
                    >
                      no direct coefficient — harm embodied in stored electricity
                    </td>
                  </tr>
                );
              }
              const coeff = MORTALITY[key];
              return (
                <tr
                  key={s.key}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50"
                >
                  <td className="px-3 py-2">{s.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {coeff.central}
                    <span className="text-zinc-400">
                      {" "}
                      ({coeff.low}–{coeff.high})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Math.round(coeff.modeledShare * 100)}%
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={levelSourceUrl(coeff.source)}
                      className="underline hover:text-accent"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Level
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <p>
          Assigning a dollar value to mortality is a moral choice, not something
          the model resolves. VSL figures are HHS&apos;s published range, shown
          as published values — not as endorsement.
        </p>
        <p>
          Deaths are an accounting attribution by generating region, not an
          atmospheric model: real pollution crosses regional boundaries. The
          uncertainty band above propagates into any priced-mortality cost — a
          priced total is a band, not a single number.
        </p>
      </div>
    </div>
  );
}
