"use client";

// Installed capacity (MW) over time, stacked by source. A faithful sibling of
// EnergyMixChart (same design-system colors, tokens, legend, tooltip) but on the
// _MW field instead of _MWh -- capacity is what gets *built*, generation is what
// actually runs, and the two diverge (a big plant that rarely runs is large MW,
// small MWh). Uses the same CVD-validated per-source palette from sources.ts.
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SOURCES } from "@/lib/sources";
import { formatPowerIn, pickPowerUnit, type PowerUnit } from "@/lib/format";
import type { YearRecord } from "@/lib/library";
import { useForceResizeOnMount } from "@/lib/useForceResizeOnMount";

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
}

function CapacityTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: number;
  unit: PowerUnit;
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
      {rows.map((row) => {
        const source = SOURCES.find((s) => `${s.key}_MW` === row.dataKey);
        if (!source) return null;
        return (
          <div
            key={row.dataKey}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              lineHeight: 1.6,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: source.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "var(--ink-primary)", fontWeight: 600 }}>
              {formatPowerIn(row.value, unit)}
            </span>
            <span style={{ color: "var(--ink-secondary)" }}>{source.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CapacityChart({ data }: { data: YearRecord[] }) {
  useForceResizeOnMount();

  const maxStackedMw = Math.max(
    ...data.map((row) =>
      SOURCES.reduce((sum, s) => sum + (row[`${s.key}_MW`] ?? 0), 0)
    )
  );
  const unit = pickPowerUnit(maxStackedMw);

  return (
    <div
      role="img"
      aria-label="Stacked area chart of installed generating capacity by source (solar, wind, nuclear, gas, coal, battery) over time, in megawatts. The full year-by-year figures are available in the data table on this page."
    >
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid
            strokeDasharray="0"
            stroke="var(--chart-gridline)"
            vertical={false}
          />
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
            tickFormatter={(v) => formatPowerIn(v, unit)}
            tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip content={<CapacityTooltip unit={unit} />} />
          <Legend
            iconType="square"
            wrapperStyle={{ color: "var(--ink-secondary)", fontSize: 13 }}
            itemSorter={(item) =>
              SOURCES.findIndex((s) => s.label === item.value)
            }
          />
          {SOURCES.map((source) => (
            <Area
              key={source.key}
              type="monotone"
              dataKey={`${source.key}_MW`}
              name={source.label}
              stackId="cap"
              stroke={source.color}
              strokeWidth={1.5}
              fill={source.color}
              fillOpacity={0.85}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
