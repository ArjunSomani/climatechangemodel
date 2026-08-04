import Link from "next/link";

export const metadata = {
  title: "About — Optimize",
  description:
    "What Optimize is, why it prices two externalities, and where its engine and data come from.",
};

const PILLARS: { title: string; body: string }[] = [
  {
    title: "Carbon",
    body: "A price on CO₂ pollution that the electricity market never charges for.",
  },
  {
    title: "Mortality",
    body: "A price per death — the accidents and air pollution that different power sources cause.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        About Optimize
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Optimize is an hourly grid model that finds the cheapest way to
        decarbonize US electricity across 13 regions — and lets you put a
        price on two harms the market ignores to see how the cheapest grid
        changes.
      </p>

      <Section title="What it is">
        <p>
          For each region, the model runs the grid hour by hour and asks a
          single question: what is the least-cost mix of power sources that
          still keeps the lights on? On top of that, you can turn two dials —
          a price on carbon and a price on mortality — and watch the
          least-cost answer shift.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="font-medium text-black dark:text-zinc-50">
                {p.title}
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {p.body}
              </p>
            </div>
          ))}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          New here? Start with{" "}
          <Link href="/how-it-works" className="underline">
            How it works
          </Link>
          .
        </p>
      </Section>

      <Section title="Why price two externalities">
        <p>
          Carbon isn&rsquo;t the only harm the market leaves off the bill.
          Every source of power also costs lives, and the sources are wildly
          unequal. Pricing both lets you see the full trade-off instead of
          optimizing one harm while ignoring another. The goal is honesty
          about what a decision costs, not advocacy for a particular grid.
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
          <li>
            <strong>Mortality coefficients are imported, not
            re-derived.</strong>{" "}They come from{" "}
            <a href="https://levelmodel.vercel.app" className="underline">
              Level
            </a>{" "}
            as a low/central/high band per source, and every figure links
            back to its source there.
          </li>
          <li>
            <strong>VSL is presented, never endorsed.</strong>{" "}The value of a
            statistical life uses HHS&rsquo;s published range. We show the
            numbers as published values you can adjust — not as a figure we
            stand behind.
          </li>
          <li>
            <strong>Outputs are framed as conditions, not
            recommendations.</strong>{" "}A result reads as &ldquo;what would
            have to be true — what carbon and mortality prices — for this to
            be the cheapest grid,&rdquo; not &ldquo;this is the grid you
            should build.&rdquo;
          </li>
        </ul>
      </Section>

      <Section title="What it doesn't claim">
        <p>
          The model rests on real data and explicit assumptions, and those
          assumptions have limits: no transmission between regions, historical
          weather repeated forward, hourly (not sub-hourly) resolution, and
          more. Read them before trusting any single result.
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
          <li>
            <Link href="/methodology" className="underline">
              Methodology
            </Link>{" "}
            — the full list of assumptions, limitations, and data sources.
          </li>
          <li>
            <Link href="/safety" className="underline">
              Safety &amp; mortality
            </Link>{" "}
            — how mortality is counted, framed, and where the numbers are
            uncertain.
          </li>
        </ul>
      </Section>

      <Section title="Provenance and credit">
        <p>
          Optimize is a web front end built around an existing modeling engine
          and data pipeline — the{" "}
          <a
            href="https://github.com/cliffgold/Optimize"
            className="underline"
          >
            cliffgold/Optimize
          </a>{" "}
          project. The optimizer, the spec sheet, and the grid model come from
          that repository; this site presents its results.
        </p>
        <p>
          The runs are grounded in real US Energy Information Administration
          (EIA) hourly generation data across 13 regions — not synthetic or
          illustrative numbers.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          For licensing and versioning details, see the{" "}
          <Link href="/methodology" className="underline">
            methodology page
          </Link>
          .
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
