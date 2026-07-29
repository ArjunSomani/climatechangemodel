"use client";

// Utilization (capacity factor) per source over time: what fraction of the time
// each source's installed capacity is actually producing. Nuclear runs almost
// always; solar only when the sun's up. One line per source, same CVD-validated
// per-source palette as the mix charts. Reads the clean _Cap_Factor field (0-1).
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
import { SOURCES } from "@/lib/sources";
import type { YearRecord } from "@/lib/library";
import { useForceResizeOnMount } from "@/lib/useForceResizeOnMount";
import { legendLabel } from "@/lib/chartLegend";

interface TooltipEntry {
  dataKey: string;
  value: number;
  color: string;
}

function CapFactorTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
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
        const source = SOURCES.find((s) => `${s.key}_cf` === row.dataKey);
        if (!source) return null;
        return (
          <div
            key={row.dataKey}
            style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 1.6 }}
          >
            <span
              style={{
                width: 14,
                height: 2,
                background: source.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "var(--ink-primary)", fontWeight: 600 }}>
              {row.value.toFixed(0)}%
            </span>
            <span style={{ color: "var(--ink-secondary)" }}>{source.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CapacityFactorChart({ data }: { data: YearRecord[] }) {
  useForceResizeOnMount();

  const rows = data.map((r) => {
    const row: Record<string, number> = { Year: r.Year };
    SOURCES.forEach((s) => {
      row[`${s.key}_cf`] = (r[`${s.key}_Cap_Factor`] ?? 0) * 100;
    });
    return row;
  });

  return (
    <div
      role="img"
      aria-label="Line chart of each source's capacity factor (percent of the time it runs) over time. The full year-by-year figures are in the data table on this page."
    >
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CapFactorTooltip />} />
          <Legend
            wrapperStyle={{ color: "var(--ink-secondary)", fontSize: 13 }}
            formatter={(_v, entry) => {
              const key = (entry as { dataKey?: string }).dataKey ?? "";
              return legendLabel(SOURCES.find((s) => `${s.key}_cf` === key)?.label ?? "");
            }}
          />
          {SOURCES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={`${s.key}_cf`}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
