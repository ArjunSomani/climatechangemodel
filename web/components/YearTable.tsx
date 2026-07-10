import type { CSSProperties } from "react";
import { SOURCES } from "@/lib/sources";
import { formatEnergy } from "@/lib/format";
import type { YearRecord } from "@/lib/library";

// Relief channel for the chart's contrast WARN (dataviz skill: a sub-3:1
// categorical color obligates visible labels or a table view). Also lets
// readers get exact values the chart's stacking makes hard to read off
// for the middle series.
export function YearTable({ data }: { data: YearRecord[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--chart-baseline)" }}>
            <th style={thStyle}>Year</th>
            {SOURCES.map((s) => (
              <th key={s.key} style={thStyle}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: s.color,
                    marginRight: 6,
                  }}
                />
                {s.label}
              </th>
            ))}
            <th style={thStyle}>Outage</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.Year} style={{ borderBottom: "1px solid var(--chart-gridline)" }}>
              <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>
                {row.Year}
              </td>
              {SOURCES.map((s) => (
                <td key={s.key} style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>
                  {formatEnergy(row[`${s.key}_MWh`] ?? 0)}
                </td>
              ))}
              <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>
                {formatEnergy(row.Outage_MWh ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "6px 12px",
  color: "var(--ink-secondary)",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "6px 12px",
  color: "var(--ink-primary)",
  whiteSpace: "nowrap",
};
