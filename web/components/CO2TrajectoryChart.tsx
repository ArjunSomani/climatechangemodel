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
import type { LibraryCaseDetail } from "@/lib/library";
import { caseLabel, totalCO2MT } from "@/lib/metrics";
import { useForceResizeOnMount } from "@/lib/useForceResizeOnMount";

// Same 8-slot categorical palette as the energy-mix chart, but a
// different identity dimension here (case, not energy source) --
// assigned in fixed order 1..N per the dataviz skill, never cycled.
const COMPARE_COLORS = [
  "var(--compare-1)",
  "var(--compare-2)",
  "var(--compare-3)",
  "var(--compare-4)",
  "var(--compare-5)",
  "var(--compare-6)",
  "var(--compare-7)",
  "var(--compare-8)",
];

interface TooltipEntry {
  dataKey: string;
  value: number;
  color: string;
}

function CO2Tooltip({
  active,
  payload,
  label,
  labels,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
  labels: Record<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = [...payload].sort((a, b) => b.value - a.value);

  return (
    <div
      style={{
        background: "var(--chart-surface)",
        border: "1px solid var(--chart-baseline)",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 13,
      }}
    >
      <div style={{ color: "var(--ink-muted)", marginBottom: 4 }}>
        Year {label}
      </div>
      {rows.map((row) => (
        <div
          key={row.dataKey}
          style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 1.6 }}
        >
          <span
            style={{
              width: 14,
              height: 2,
              background: row.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span style={{ color: "var(--ink-primary)", fontWeight: 600 }}>
            {row.value.toFixed(1)} MT
          </span>
          <span style={{ color: "var(--ink-secondary)" }}>
            {labels[row.dataKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CO2TrajectoryChart({ cases }: { cases: LibraryCaseDetail[] }) {
  useForceResizeOnMount();

  const allYears = Array.from(
    new Set(cases.flatMap((c) => c.result.map((r) => r.Year)))
  ).sort((a, b) => a - b);

  const data = allYears.map((year) => {
    const row: Record<string, number> = { Year: year };
    cases.forEach((c) => {
      const record = c.result.find((r) => r.Year === year);
      if (record) row[c.case_id] = totalCO2MT(record);
    });
    return row;
  });

  const labels = Object.fromEntries(cases.map((c) => [c.case_id, caseLabel(c)]));

  return (
    <div
      role="img"
      aria-label={`Line chart of CO₂ emissions in metric tons over time, one line per compared scenario: ${cases
        .map((c) => caseLabel(c))
        .join("; ")}.`}
    >
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="0" stroke="var(--chart-gridline)" vertical={false} />
        <XAxis
          dataKey="Year"
          type="number"
          domain={["dataMin", "dataMax"]}
          allowDecimals={false}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--chart-baseline)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v.toFixed(0)} MT`}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip content={<CO2Tooltip labels={labels} />} />
        <Legend
          wrapperStyle={{ color: "var(--ink-secondary)", fontSize: 13 }}
          formatter={(_value, entry) => labels[(entry as { dataKey?: string }).dataKey ?? ""] ?? ""}
        />
        {cases.map((c, i) => (
          <Line
            key={c.case_id}
            type="monotone"
            dataKey={c.case_id}
            name={c.case_id}
            stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}
