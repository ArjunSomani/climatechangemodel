"use client";

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
import { formatEnergyIn, pickEnergyUnit, type EnergyUnit } from "@/lib/format";
import type { YearRecord } from "@/lib/library";
import { useForceResizeOnMount } from "@/lib/useForceResizeOnMount";

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
}

function EnergyMixTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: number;
  unit: EnergyUnit;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Highest contribution first -- reader wants the biggest number up top.
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
        const source = SOURCES.find((s) => `${s.key}_MWh` === row.dataKey);
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
              {formatEnergyIn(row.value, unit)}
            </span>
            <span style={{ color: "var(--ink-secondary)" }}>
              {source.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function EnergyMixChart({ data }: { data: YearRecord[] }) {
  useForceResizeOnMount();

  const maxStackedMwh = Math.max(
    ...data.map((row) => SOURCES.reduce((sum, s) => sum + (row[`${s.key}_MWh`] ?? 0), 0))
  );
  const unit = pickEnergyUnit(maxStackedMwh);

  return (
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
          tickFormatter={(v) => formatEnergyIn(v, unit)}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip content={<EnergyMixTooltip unit={unit} />} />
        <Legend
          iconType="square"
          wrapperStyle={{ color: "var(--ink-secondary)", fontSize: 13 }}
          // Recharts' default itemSorter is "value" (alphabetical by label);
          // rank by the fixed categorical/stacking order instead (Solar -> Battery).
          itemSorter={(item) =>
            SOURCES.findIndex((s) => s.label === item.value)
          }
        />
        {SOURCES.map((source) => (
          <Area
            key={source.key}
            type="monotone"
            dataKey={`${source.key}_MWh`}
            name={source.label}
            stackId="mix"
            stroke={source.color}
            strokeWidth={1.5}
            fill={source.color}
            fillOpacity={0.85}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
