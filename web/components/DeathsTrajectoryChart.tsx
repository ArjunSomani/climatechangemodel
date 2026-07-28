"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { YearRecord } from "@/lib/library";
import { computeScenarioDeaths } from "@/lib/mortality";
import { useForceResizeOnMount } from "@/lib/useForceResizeOnMount";

function fmt(n: number): string {
  if (n < 10) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return Math.round(n).toLocaleString();
}

interface Row {
  Year: number;
  low: number;
  range: number;
  central: number;
  high: number;
}

function DeathsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const r = payload[0].payload;
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
      <div style={{ color: "var(--ink-muted)", marginBottom: 4 }}>Year {label}</div>
      <div style={{ color: "var(--ink-primary)", fontWeight: 600 }}>
        {fmt(r.central)} deaths
      </div>
      <div style={{ color: "var(--ink-secondary)" }}>
        band {fmt(r.low)}–{fmt(r.high)}
      </div>
    </div>
  );
}

// Annual deaths as a band (low–central–high) over the horizon. Single measure,
// single hue -- the uncertainty band is the point, so it's drawn explicitly
// (a transparent base area up to `low`, a translucent area of `high-low`
// stacked on top, and the central line over it).
export function DeathsTrajectoryChart({ result }: { result: YearRecord[] }) {
  useForceResizeOnMount();

  const perYear = computeScenarioDeaths(result).perYear;
  const data: Row[] = perYear.map((y) => ({
    Year: y.year,
    low: y.low,
    range: y.high - y.low,
    central: y.central,
    high: y.high,
  }));

  const total = perYear.reduce((a, y) => a + y.central, 0);

  return (
    <div>
      <div
        role="img"
        aria-label={`Area chart of annual deaths from ${data[0]?.Year ?? ""} to ${
          data[data.length - 1]?.Year ?? ""
        }, shown as a central estimate with a high-side uncertainty band. Cumulative central deaths over the horizon: ${fmt(
          total
        )}.`}
      >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
            tickFormatter={(v) => fmt(v)}
            tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
            label={{
              value: "deaths / year",
              angle: -90,
              position: "insideLeft",
              fill: "var(--ink-secondary)",
              fontSize: 11,
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip content={<DeathsTooltip />} />
          <Area
            dataKey="low"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
          />
          <Area
            dataKey="range"
            stackId="band"
            stroke="none"
            fill="var(--mortality)"
            fillOpacity={0.16}
            isAnimationActive={false}
          />
          <Line
            dataKey="central"
            type="monotone"
            stroke="var(--mortality)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={{ background: "var(--mortality)" }}
          />
          central estimate
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-sm"
            style={{
              background:
                "color-mix(in srgb, var(--mortality) 16%, transparent)",
            }}
          />
          low–high uncertainty band
        </span>
      </p>
    </div>
  );
}
