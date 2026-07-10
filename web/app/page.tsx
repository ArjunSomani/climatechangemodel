import Link from "next/link";
import { getLibraryCase } from "@/lib/library";
import { EnergyMixChart } from "@/components/EnergyMixChart";

export const dynamic = "force-dynamic";

const TEASER_CASE_ID = "default/default/constant_co2/co2_500_0/CAL";

export default async function Home() {
  const teaser = await getLibraryCase(TEASER_CASE_ID);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Optimize
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          What happens to the US electricity grid over the next 27 years under
          different policy scenarios? An hourly optimization model finds the
          cheapest mix of solar, wind, nuclear, gas, coal, and storage to meet
          demand — and shows the cheapest paths to cutting carbon emissions.
        </p>
        <div className="mt-8">
          <Link
            href="/library"
            className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Browse the scenario library →
          </Link>
        </div>
      </div>

      {teaser && (
        <div className="mt-16">
          <p className="mb-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
            California under a $500/MT CO₂ price — nuclear and wind grow in,
            gas grows out
          </p>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <EnergyMixChart data={teaser.result} />
          </div>
        </div>
      )}

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        <ValueCard
          title="Real EIA data"
          body="Built on the US Energy Information Administration's hourly generation data across 13 regions."
        />
        <ValueCard
          title="Hourly optimization"
          body="Every year, a numerical optimizer picks the lowest-cost build-out that still meets demand every single hour."
        />
        <ValueCard
          title="Compare policy scenarios"
          body="See how CO₂ pricing, interest rates, and build rates change the cheapest path to decarbonization."
        />
      </div>
    </div>
  );
}

function ValueCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h3 className="font-medium text-black dark:text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}
