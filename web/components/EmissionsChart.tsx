"use client";

// Annual CO2 emissions (Mt) over time for a single case. CO2 is computed from
// generation x intensity (lib/co2.ts), NOT the engine's sample_years-inflated
// field. Single series, one hue -- magnitude over time.
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { co2MtFromGeneration } from "@/lib/co2";
import type { YearRecord } from "@/lib/library";
import { useForceResizeOnMount } from "@/lib/useForceResizeOnMount";

interface TooltipEntry {
  value: number;
}

function EmissionsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
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
      <div style={{ color: "var(--ink-primary)", fontWeight: 600 }}>
        {payload[0].value.toFixed(1)} Mt CO₂
      </div>
    </div>
  );
}

export function EmissionsChart({ data }: { data: YearRecord[] }) {
  useForceResizeOnMount();

  const rows = data.map((r) => ({ Year: r.Year, co2: co2MtFromGeneration(r) }));

  return (
    <div
      role="img"
      aria-label="Area chart of annual CO₂ emissions in megatonnes over time. The full year-by-year figures are in the data table on this page."
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
            tickFormatter={(v) => `${v.toFixed(0)} Mt`}
            tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<EmissionsTooltip />} />
          <Area
            type="monotone"
            dataKey="co2"
            name="CO₂"
            stroke="var(--compare-1)"
            strokeWidth={2}
            fill="var(--compare-1)"
            fillOpacity={0.2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
