import Link from "next/link";

const ASSUMPTIONS = [
  "13 US regions, optimized independently",
  "No transmission between regions",
  "2020–2025 weather repeats every year",
];

export function AssumptionsBadges() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      {ASSUMPTIONS.map((a) => (
        <span
          key={a}
          className="rounded-full border border-zinc-200 px-2.5 py-1 dark:border-zinc-800"
        >
          {a}
        </span>
      ))}
      <Link href="/methodology" className="underline">
        Full list of assumptions →
      </Link>
    </div>
  );
}
