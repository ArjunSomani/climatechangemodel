import Link from "next/link";
import { RiskLadder } from "@/components/RiskLadder";
import {
  MoralChoiceNote,
  AttributionNote,
  CountedModeledNote,
} from "@/components/SafetyDisclosure";
import { VSL_PRESETS, coalVsSolarFactor, formatVsl } from "@/lib/mortality";

export const metadata = {
  title: "Safety & mortality — Optimize",
  description:
    "Electricity kills people — unevenly. How Optimize prices mortality as a second externality alongside carbon.",
};

export default function SafetyPage() {
  const coalVsSolar = Math.round(coalVsSolarFactor());

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
        The second externality
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance">
        Electricity kills people — unevenly
      </h1>
      <p className="mt-5 text-lg text-zinc-600 dark:text-zinc-400">
        Every source of power carries a death toll: mining and drilling
        accidents, and — far larger — the air pollution that shortens lives
        downwind. Per unit of energy, coal is roughly{" "}
        <span className="font-semibold text-black dark:text-zinc-50">
          {coalVsSolar}×
        </span>{" "}
        deadlier than solar. The electricity market never charges for any of it.
        Optimize lets you put a price on it.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-medium">The risk ladder</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Deaths per terawatt-hour, by source. The scale is logarithmic —
          each step is a multiple, not an addition — because the sources span
          three orders of magnitude.
        </p>
        <div className="mt-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <RiskLadder />
        </div>
        <div className="mt-3">
          <CountedModeledNote />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-medium">
          A carbon price and a mortality price are the same object
        </h2>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          Both take a harm the market doesn&apos;t charge for, attach a dollar
          figure to it, and let the optimizer respond. Optimize already prices
          carbon. Mortality is one more coefficient, one more slider, one more
          linear term in exactly the same cost function.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ParallelCard
            title="Carbon price"
            unit="$ / ton CO₂"
            body="Multiplies each source's CO₂ intensity. Coal and gas get steadily more expensive as the price rises."
          />
          <ParallelCard
            title="Mortality price"
            unit="$ / death"
            body="Multiplies each source's death rate. Coal is hit hardest; gas much less, because gas is ~9× cleaner on deaths."
          />
        </div>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          They don&apos;t agree. Coal exits under either. Gas is where they
          diverge: it&apos;s ~9× better than coal on deaths but only ~1.7× better
          on CO₂ — so a mortality price tolerates gas where a carbon price pushes
          past it. Move both sliders on the{" "}
          <Link href="/custom-run" className="underline hover:text-accent">
            custom run
          </Link>{" "}
          page to see it.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-medium">What is a life worth?</h2>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          To price mortality you need a dollar value per death — a{" "}
          <em>value of a statistical life</em> (VSL). HHS&apos;s 2026 regulatory
          guidance publishes a range, not a single number (constant 2025
          dollars):
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {VSL_PRESETS.map((p) => (
            <div
              key={p.label}
              className="rounded-xl border border-zinc-200 py-4 dark:border-zinc-800"
            >
              <div className="font-display text-2xl font-semibold">
                {formatVsl(p.value)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {p.label}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <MoralChoiceNote />
        </div>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Outputs are framed as{" "}
          <em>what would have to be true for this to be the cheapest grid</em> —
          not as a recommendation of any particular number.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-medium">Every number here is a band</h2>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          You&apos;ll see deaths reported as a{" "}
          <span className="font-medium">low–central–high</span> range, not a
          single figure. That band is real scientific uncertainty, and it comes
          from two independent places:
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ParallelCard
            title="How deadly each source is"
            unit="deaths / TWh"
            body="Every rate is published as a range. Coal's depends on how air-pollution exposure is modeled; hydro's high bound includes the 1975 Banqiao dam failure, its low bound excludes it. The risk ladder above shows each source's central rate with its low–high in the tooltip."
          />
          <ParallelCard
            title="What a life is worth"
            unit="$ / death"
            body="The VSL is itself a low/central/high range (the three cards above), not a point. It's a separate axis of uncertainty layered on top of the death rates."
          />
        </div>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Deaths inherit the first band. A priced-mortality{" "}
          <em>cost</em> inherits both — which is why any dollar figure that
          includes mortality is reported as a band too, never a single number.
          The honest read is the width of the band, not the midpoint.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-medium">Where the deaths land</h2>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          CO₂ is a global pollutant — it doesn&apos;t matter where it&apos;s
          emitted. Air-pollution deaths are local. Optimize reports{" "}
          <span className="font-medium">production-based</span> deaths, attributed
          to the region that did the generating.
        </p>
        <div className="mt-4">
          <AttributionNote />
        </div>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          A <span className="font-medium">consumption-based</span> account — which
          region <em>used</em> the electricity, so a region can import clean-looking
          power while exporting its mortality — needs an hourly inter-regional
          transfer matrix Optimize doesn&apos;t yet model. It&apos;s the marquee
          next step, not done here.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-medium">Deliberately out of scope</h2>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          This lens is mortality only. Morbidity (illness short of death), water
          use, land use, critical minerals, and equity-weighting of deaths by
          affected population are all real and all excluded — several are worth
          adding later; none belong in this first cut.
        </p>
      </section>

      <div className="mt-12 rounded-xl border border-zinc-200 p-6 text-center dark:border-zinc-800">
        <p className="text-zinc-600 dark:text-zinc-400">
          The numbers here are imported from{" "}
          <a
            href="https://levelmodel.vercel.app"
            className="underline hover:text-accent"
            target="_blank"
            rel="noreferrer"
          >
            Level
          </a>
          , the descriptive reference for these figures. Optimize turns them into
          a lever.
        </p>
        <Link
          href="/custom-run"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Price mortality in a custom run →
        </Link>
      </div>
    </div>
  );
}

function ParallelCard({
  title,
  unit,
  body,
}: {
  title: string;
  unit: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium text-black dark:text-zinc-50">{title}</h3>
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {unit}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}
