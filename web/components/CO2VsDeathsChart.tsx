"use client";

import {
  CartesianGrid,
  Legend,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  ResponsiveContainer,
} from "recharts";
import type { LibraryCaseDetail } from "@/lib/library";
import { caseLabel, totalCO2MT } from "@/lib/metrics";
import { computeYearDeaths } from "@/lib/mortality";
import { useForceResizeOnMount } from "@/lib/useForceResizeOnMount";

// Same fixed 8-slot categorical order as the other Compare charts, so a case
// keeps one identity color across every view.
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

interface Point {
  co2: number;
  deaths: number;
  label: string;
}

function FrontierTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
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
      <div style={{ color: "var(--ink-primary)", fontWeight: 600, marginBottom: 2 }}>
        {p.label}
      </div>
      <div style={{ color: "var(--ink-secondary)" }}>
        {p.co2.toFixed(1)} MT CO₂ · {Math.round(p.deaths).toLocaleString()} deaths
      </div>
    </div>
  );
}

// The two externalities on one plane: final-year CO₂ (x) against final-year
// deaths (y), one point per scenario. Reveals the trade-off frontier -- and
// where a carbon-leaning scenario and a mortality-leaning one part ways.
export function CO2VsDeathsChart({ cases }: { cases: LibraryCaseDetail[] }) {
  useForceResizeOnMount();

  const points: (Point & { color: string })[] = cases.map((c, i) => {
    const last = c.result[c.result.length - 1];
    return {
      co2: totalCO2MT(last),
      deaths: computeYearDeaths(last).central,
      label: caseLabel(c),
      color: COMPARE_COLORS[i % COMPARE_COLORS.length],
    };
  });

  return (
    <div
      role="img"
      aria-label={
        "Scatter plot of final-year CO₂ emissions against final-year deaths, one point per scenario: " +
        points
          .map(
            (p) =>
              `${p.label} at ${p.co2.toFixed(1)} MT and ${Math.round(
                p.deaths
              ).toLocaleString()} deaths`
          )
          .join("; ") +
        "."
      }
    >
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 24 }}>
          <CartesianGrid stroke="var(--chart-gridline)" />
          <XAxis
            type="number"
            dataKey="co2"
            name="CO₂"
            tickFormatter={(v) => `${v.toFixed(0)}`}
            tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--chart-baseline)" }}
            tickLine={false}
            label={{
              value: "CO₂ emitted (MT, final year)",
              position: "bottom",
              fill: "var(--ink-secondary)",
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            dataKey="deaths"
            name="Deaths"
            tickFormatter={(v) => Math.round(v).toLocaleString()}
            tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={64}
            label={{
              value: "Deaths (final year)",
              angle: -90,
              position: "insideLeft",
              fill: "var(--ink-secondary)",
              fontSize: 12,
              style: { textAnchor: "middle" },
            }}
          />
          <ZAxis range={[120, 120]} />
          <Tooltip content={<FrontierTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          <Legend wrapperStyle={{ color: "var(--ink-secondary)", fontSize: 13 }} />
          {points.map((p) => (
            <Scatter key={p.label} name={p.label} data={[p]} fill={p.color} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
