import Link from "next/link";
import { listLibraryCases } from "@/lib/library";

export const metadata = {
  title: "Library — Optimize",
};

// Reflects live Neon data (changes whenever generate_library.py re-runs) --
// must not be prerendered/cached at build time.
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const cases = await listLibraryCases();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Scenario library
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Pre-computed runs. Pick one to see how the energy mix shifts over time.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cases.map((c) => (
          <Link
            key={c.case_id}
            href={`/library/${c.case_id}`}
            className="rounded-lg border border-zinc-200 p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {c.group_name} · {c.co2_regime.replace("_", " ")}
            </div>
            <div className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">
              CO₂ price ${c.co2_initial}/MT
            </div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {c.region} · {c.years} years
            </div>
          </Link>
        ))}
      </div>

      {cases.length === 0 && (
        <p className="mt-8 text-zinc-500 dark:text-zinc-400">
          No cases yet — run engine/scripts/generate_library.py.
        </p>
      )}
    </div>
  );
}
