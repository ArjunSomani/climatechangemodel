// Pure helpers usable from client components -- must not import lib/db.ts
// (pulls the 'pg' package, which breaks the client bundle) or lib/library.ts
// non-type exports. Types are fine to import with `import type`.
import { SOURCES } from "@/lib/sources";
import type { LibraryCaseSummary, YearRecord } from "@/lib/library";

function humanize(s: string): string {
  return s.replace(/_/g, " ");
}

export function caseLabel(c: LibraryCaseSummary): string {
  const variantPart =
    c.variant !== "Default" ? ` ${humanize(c.variant)}` : "";
  return `${c.region} · ${humanize(c.group_name)}${variantPart} · $${c.co2_initial}/MT`;
}

export function totalCO2MT(record: YearRecord): number {
  return SOURCES.reduce((sum, s) => sum + (record[`${s.key}_CO2_MT`] ?? 0), 0);
}
