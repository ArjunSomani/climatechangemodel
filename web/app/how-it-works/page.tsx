import Link from "next/link";

export const metadata = {
  title: "How It Works — Optimize",
  description: "How the grid decarbonization model works, in plain terms.",
};

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        How it works
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        The model asks one question, every year, for 27 years: what&rsquo;s
        the cheapest mix of power sources that still keeps the lights on
        every single hour? Here&rsquo;s how it answers that.
      </p>

      <Section title="The data">
        <p>
          Everything starts from real hourly electricity generation data from
          the US Energy Information Administration (EIA) — January 2020
          through December 2025, six full years, across 13 US regions.
          That&rsquo;s about 684,000 hourly readings, broken down by source:
          solar, wind, nuclear, gas, coal, hydro, oil, and &ldquo;other.&rdquo;
        </p>
        <p>
          The model assumes supply always equaled demand in that historical
          data (the grid didn&rsquo;t black out, so whatever was generated is
          treated as however much was needed), and it defines a source&rsquo;s
          &ldquo;capacity&rdquo; as the highest output it ever hit in a single
          hour during that window.
        </p>
        <p>
          Hydro, oil, and &ldquo;other&rdquo; are along for the ride — the
          model assumes they keep growing in step with demand, but it never
          decides to build more or less of them. Solar, wind, nuclear, gas,
          and coal are the five sources it actually optimizes, plus a
          synthetic sixth: grid-scale battery storage, which doesn&rsquo;t
          exist in year zero and has to be built up from nothing.
        </p>
      </Section>

      <Section title="The knobs">
        <p>
          Two knobs represent policy choices, one represents financing, and
          each of the six sources gets its own cost/build knobs:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>CO₂ price</strong>{" "}— a starting $/MT figure that climbs
            each year (by a fixed step) up to a cap. Every source pays this
            price on the carbon it emits, so a higher price makes gas and
            coal steadily more expensive relative to solar, wind, and
            nuclear.
          </li>
          <li>
            <strong>Demand growth</strong>{" "}— how much more electricity the
            region needs each year, e.g. 2%.
          </li>
          <li>
            <strong>Interest rate</strong>{" "}— the cost of borrowing to build
            new capacity. This alone can make or break nuclear: it&rsquo;s
            financed over decades, so a cheap government loan changes its
            economics far more than it changes gas, which is cheap to build
            and pays for itself quickly.
          </li>
          <li>
            <strong>Per-source knobs</strong>{" "}— capital cost, fixed O&amp;M,
            variable O&amp;M, plant lifetime, and maximum build rate can each
            be tweaked independently. The real starting numbers: nuclear
            costs about 5x more per MW to build than gas, but lasts 60 years
            to gas&rsquo;s 35, and the model caps new nuclear at under 2% of
            total grid capacity per year (gas can grow at over 6.5%/year —
            it&rsquo;s just faster to build).
          </li>
        </ul>
      </Section>

      <Section title="Model flow, year by year">
        <p>Starting from the real 2024 mix, each simulated year:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Old plants retire.</strong>{" "}Every source loses a slice of
            its capacity equal to 1/lifetime — a 25-year solar fleet loses 4%
            a year, a 60-year nuclear fleet loses under 2%.
          </li>
          <li>
            <strong>Demand grows</strong>{" "}by that year&rsquo;s growth rate.
          </li>
          <li>
            <strong>An optimizer decides what to build.</strong>{" "}For each
            source, it picks a build fraction — bounded by that source&rsquo;s
            max build rate plus whatever just retired (so it can always at
            least rebuild what it lost) — that minimizes total system cost.
          </li>
          <li>
            <strong>The grid gets dispatched, hour by hour.</strong>{" "}The
            cheapest sources (after accounting for CO₂ cost) supply power
            first. Anything left over charges the battery; anything still
            unmet draws the battery down. Whatever&rsquo;s still short after
            that is an <strong>outage</strong>{" "}— and outages carry a steep
            cost penalty, so the optimizer works hard to avoid them.
          </li>
          <li>
            <strong>Cost gets tallied</strong>: financed capital + fixed
            O&amp;M for everything built, variable O&amp;M + CO₂ cost for
            everything generated, plus any outage penalty. The optimizer
            repeats step 3 until two runs agree within 1%, then locks in that
            year&rsquo;s answer and moves to the next year.
          </li>
        </ol>
      </Section>

      <Section title="Reading the results">
        <p>A few terms that show up throughout the site:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>MW vs. MWh</strong>{" "}— MW is installed capacity (how big
            the fleet is); MWh is actual energy generated over a year (how
            much it actually ran). A source can have a lot of MW and still
            generate relatively little MWh if it doesn&rsquo;t run often.
          </li>
          <li>
            <strong>Capacity factor</strong>{" "}— MWh generated ÷ (MW ×
            hours in the year). Nuclear typically runs near-constant (a high
            capacity factor); solar only generates when the sun&rsquo;s out
            (a much lower one).
          </li>
          <li>
            <strong>Outage</strong>{" "}— demand that went unmet in a given hour,
            after every source and the battery have been tapped. In a
            well-behaved scenario this should be at or near zero every year.
          </li>
        </ul>
        <p>
          The <Link href="/library" className="underline">library</Link> has
          real runs to explore, or head to{" "}
          <Link href="/compare" className="underline">compare</Link> to see
          how two scenarios diverge.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-medium text-black dark:text-zinc-50">
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}
