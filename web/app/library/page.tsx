import { listLibraryCases } from "@/lib/library";
import { LibraryPickerClient } from "@/components/LibraryPickerClient";

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
      <h1 className="text-3xl font-semibold tracking-tight">Scenario library</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Narrow down by region, scenario, and CO₂ price to find a run.
      </p>

      <div className="mt-8">
        {cases.length > 0 ? (
          <LibraryPickerClient cases={cases} />
        ) : (
          <p className="text-zinc-500 dark:text-zinc-400">
            No cases yet — run engine/scripts/generate_library.py.
          </p>
        )}
      </div>
    </div>
  );
}
