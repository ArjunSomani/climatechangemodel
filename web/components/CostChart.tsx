"use client";

// Annual system cost broken into components (M$), stacked over time. Capital and
// fixed O&M come from the engine's already-annual fields; variable O&M and CO2
// cost are recomputed web-side (validated to match the engine exactly); the
// mortality-cost band (deaths × VSL) is shown only when the case prices mortality.
// Cost components are their own identity dimension, so they use the categorical
// compare palette in fixed order (never the source colors) + the reserved
// mortality hue for the mortality band.
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
import { operatingCosts } from "@/lib/costs";
import { computeYearDeaths } from "@/lib/mortality";
import { formatMoney } from "@/lib/format";
import type { YearRecord } from "@/lib/library";
import { useForceResizeOnMount } from "@/lib/useForceResizeOnMount";

const SERIES: { key: string; label: string; color: string }[] = [
  { key: "capital", label: "Capital", color: "var(--compare-1)" },
  { key: "fixed", label: "Fixed O&M", color: "var(--compare-2)" },
  { key: "variable", label: "Variable O&M", color: "var(--compare-3)" },
  { key: "co2", label: "CO₂ cost", color: "var(--compare-4)" },
  { key: "mortality", label: "Mortality cost", color: "var(--mortality)" },
];

interface TooltipEntry {
  dataKey: string;
  value: number;
  color: string;
}

function CostTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((s, r) => s + r.value, 0);
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
        Year {label} · total {formatMoney(total)}
      </div>
      {rows.map((row) => {
        const s = SERIES.find((x) => x.key === row.dataKey);
        if (!s) return null;
        return (
          <div
            key={row.dataKey}
            style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 1.6 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: s.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "var(--ink-primary)", fontWeight: 600 }}>
              {formatMoney(row.value)}
            </span>
            <span style={{ color: "var(--ink-secondary)" }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CostChart({
  data,
  mortalityPrice,
}: {
  data: YearRecord[];
  mortalityPrice?: number;
}) {
  useForceResizeOnMount();
  const showMortality = !!mortalityPrice && mortalityPrice > 0;

  const rows = data.map((r) => {
    const c = operatingCosts(r);
    const mortality = showMortality
      ? (computeYearDeaths(r).central * mortalityPrice) / 1_000_000
      : 0;
    return { Year: r.Year, ...c, mortality };
  });

  const series = SERIES.filter((s) => s.key !== "mortality" || showMortality);

  return (
    <div
      role="img"
      aria-label="Stacked area chart of annual system cost by component (capital, fixed O&M, variable O&M, CO₂ cost, and mortality cost when priced) over time, in millions of dollars."
    >
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
            tickFormatter={(v) => formatMoney(v)}
            tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip content={<CostTooltip />} />
          <Legend
            iconType="square"
            wrapperStyle={{ color: "var(--ink-secondary)", fontSize: 13 }}
            formatter={(_v, entry) => {
              const key = (entry as { dataKey?: string }).dataKey ?? "";
              return SERIES.find((s) => s.key === key)?.label ?? "";
            }}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stackId="cost"
              stroke={s.color}
              strokeWidth={1.5}
              fill={s.color}
              fillOpacity={0.85}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
