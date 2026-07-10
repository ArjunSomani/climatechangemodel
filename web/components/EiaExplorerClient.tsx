"use client";

import { useState } from "react";
import { EIA_SOURCES, type EiaSourceKey } from "@/lib/sources";
import { EiaTypicalDayChart } from "@/components/EiaTypicalDayChart";
import { EiaWeeklyChart } from "@/components/EiaWeeklyChart";
import type { EiaRegionData } from "@/lib/eiaExplorer";

const DEFAULT_VISIBLE: EiaSourceKey[] = ["Solar", "Wind", "Nuclear", "Gas", "Coal"];

export function EiaExplorerClient({ data }: { data: EiaRegionData }) {
  const [visible, setVisible] = useState<Set<EiaSourceKey>>(
    new Set(DEFAULT_VISIBLE)
  );

  function toggle(key: EiaSourceKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleList = Array.from(visible);

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {EIA_SOURCES.map((s) => (
          <label
            key={s.key}
            className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <input
              type="checkbox"
              checked={visible.has(s.key)}
              onChange={() => toggle(s.key)}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: s.color,
                display: "inline-block",
              }}
            />
            {s.label}
          </label>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">
          Typical day
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Average capacity used, by hour of day, across all five years.
        </p>
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <EiaTypicalDayChart data={data.typical_day} visibleSources={visibleList} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">
          Weekly average, 2020&ndash;2024
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Same data, week by week, showing the seasonal pattern and any
          year-over-year drift.
        </p>
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <EiaWeeklyChart data={data.weekly} visibleSources={visibleList} />
        </div>
      </section>

      <section className="mt-10 overflow-x-auto">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">
          Yearly max MW
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The highest hourly output ever recorded for each source, per year
          -- this is what the model treats as that source&rsquo;s starting
          capacity.
        </p>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, marginTop: 16 }}>
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                Year
              </th>
              {EIA_SOURCES.map((s) => (
                <th
                  key={s.key}
                  className="px-3 py-2 text-left font-semibold text-zinc-500 dark:text-zinc-400"
                >
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.yearly_max_mw.map((row) => (
              <tr key={row.year} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-black dark:text-zinc-50">
                  {row.year}
                </td>
                {EIA_SOURCES.map((s) => (
                  <td
                    key={s.key}
                    className="whitespace-nowrap px-3 py-2 tabular-nums text-black dark:text-zinc-50"
                  >
                    {Math.round((row[s.key] as number) ?? 0).toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
