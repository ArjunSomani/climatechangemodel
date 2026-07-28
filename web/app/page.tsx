import Link from "next/link";
import { getLibraryCase } from "@/lib/library";
import { EnergyMixChart } from "@/components/EnergyMixChart";

export const dynamic = "force-dynamic";

// Prefer the mortality headline case (coal-heavy Midwest under a mortality
// price — coal exits); fall back to the classic carbon case so the hero always
// has a chart even before the mortality cases are seeded into the library.
const MORTALITY_TEASER_ID = "mortality/central_vsl/constant_co2/co2_0_0/MIDW";
const FALLBACK_TEASER_ID = "default/default/constant_co2/co2_500_0/CAL";

export default async function Home() {
  const teaser =
    (await getLibraryCase(MORTALITY_TEASER_ID)) ??
    (await getLibraryCase(FALLBACK_TEASER_ID));
  const teaserIsMortality = teaser?.group_name === "Mortality";

  // Derive the horizon from the teaser run so the copy never goes stale as the
  // underlying EIA data is refreshed each year (the first simulated year tracks
  // the last complete year of data).
  const resultYears = teaser?.result ?? [];
  const firstYear = resultYears.length
    ? Math.round(resultYears[0].Year)
    : null;
  const lastYear = resultYears.length
    ? Math.round(resultYears[resultYears.length - 1].Year)
    : null;
  const spanLabel =
    firstYear && lastYear ? `${firstYear}–${lastYear}` : "25-year horizon";
  // Projected-year span: the run starts with a base-year row (the last complete
  // year of data), then projects forward, so the span is one less than the row
  // count -- e.g. 2025 base + 2026–2050 projected = a 25-year span.
  const spanYears =
    firstYear && lastYear ? lastYear - firstYear : 25;

  return (
    <div>
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent)",
          }}
        />
        <div className="mx-auto max-w-4xl px-6 pt-20 pb-4 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            Hourly grid optimization · {spanLabel}
          </p>
          <h1 className="font-display mt-4 text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
            The cheapest way to decarbonize the US electricity grid
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            An hourly optimizer picks the lowest-cost mix of solar, wind,
            nuclear, gas, coal, and storage to meet demand every hour, for{" "}
            {spanYears} years, under whatever policy scenario you throw at it.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/library"
              className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Browse the scenario library →
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:text-black dark:text-zinc-300 dark:hover:text-white"
            >
              How it works
            </Link>
          </div>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Or{" "}
            <Link href="/custom-run" className="underline hover:text-accent">
              try your own scenario
            </Link>{" "}
            — pick a carbon price and see what the model builds.
          </p>
          <p className="mx-auto mt-6 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
            It prices <span className="text-zinc-700 dark:text-zinc-300">two</span>{" "}
            harms the market ignores — carbon <em>and</em> mortality. Per unit of
            energy, coal is more than 1,000× deadlier than solar;{" "}
            <Link href="/safety" className="underline hover:text-accent">
              see the risk ladder
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-16">
        {teaser && (
          <div className="mt-16">
            <p className="mb-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {teaserIsMortality
                ? "The coal-heavy Midwest under a mortality price — coal exits, cleaner sources grow in"
                : "California under a $500/MT CO₂ price — nuclear and wind grow in, gas grows out"}
            </p>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <EnergyMixChart data={teaser.result} />
            </div>
          </div>
        )}

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <ValueCard
            n="01"
            title="Real EIA data"
            body="Built on the US Energy Information Administration's hourly generation data across 13 regions."
          />
          <ValueCard
            n="02"
            title="Hourly optimization"
            body="Every year, a numerical optimizer picks the lowest-cost build-out that still meets demand every single hour."
          />
          <ValueCard
            n="03"
            title="Price what the market ignores"
            body="Put a price on carbon and on mortality — the two harms electricity imposes without paying for — and watch the cheapest grid change."
          />
        </div>
      </div>
    </div>
  );
}

function ValueCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="group rounded-lg border border-zinc-200 p-5 transition-colors hover:border-accent/50 dark:border-zinc-800">
      <span className="font-display text-sm text-accent">{n}</span>
      <h3 className="font-display mt-1 text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}
