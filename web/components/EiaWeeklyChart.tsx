"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EIA_SOURCES, type EiaSourceKey } from "@/lib/sources";
import { useForceResizeOnMount } from "@/lib/useForceResizeOnMount";
import type { EiaWeekRow } from "@/lib/eiaExplorer";

export function EiaWeeklyChart({
  data,
  visibleSources,
}: {
  data: EiaWeekRow[];
  visibleSources: EiaSourceKey[];
}) {
  useForceResizeOnMount();
  const shown = EIA_SOURCES.filter((s) => visibleSources.includes(s.key));

  return (
    <div
      role="img"
      aria-label={`Line chart of weekly average capacity used over time, one line per source: ${shown
        .map((s) => s.label)
        .join(", ")}.`}
    >
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="0" stroke="var(--chart-gridline)" vertical={false} />
        <XAxis
          dataKey="date"
          type="category"
          interval="preserveStartEnd"
          minTickGap={40}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--chart-baseline)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={45}
        />
        <Tooltip
          formatter={(value, name) => [`${(Number(value) * 100).toFixed(1)}%`, name]}
          contentStyle={{
            background: "var(--chart-surface)",
            border: "1px solid var(--chart-baseline)",
            borderRadius: 6,
            fontSize: 13,
          }}
        />
        <Legend
          iconType="plainline"
          wrapperStyle={{ color: "var(--ink-secondary)", fontSize: 13 }}
          itemSorter={(item) => EIA_SOURCES.findIndex((s) => s.label === item.value)}
        />
        {shown.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}
