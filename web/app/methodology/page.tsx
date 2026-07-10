import Link from "next/link";

export const metadata = {
  title: "Methodology — Optimize",
  description: "Assumptions, limitations, and data sources behind the model.",
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Methodology
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        The short version of how this works is on the{" "}
        <Link href="/how-it-works" className="underline">
          How it works
        </Link>{" "}
        page. This page is the fine print: what the model assumes, where it
        breaks down, and where the numbers come from.
      </p>

      <Section title="What the optimizer actually does">
        <p>
          For each simulated year and region, a Nelder-Mead numerical
          optimizer chooses how much new capacity to add for each of six
          sources (solar, wind, nuclear, gas, coal, battery), bounded by that
          source&rsquo;s maximum build rate. It minimizes total system cost —
          financed capital + fixed O&amp;M for everything installed, variable
          O&amp;M + CO₂ cost for everything generated, plus a steep penalty
          for any unmet demand (&ldquo;outage&rdquo;) — subject to meeting
          demand in every one of the ~8,760 hours in the year. The optimizer
          re-runs with progressively tighter tolerances until two consecutive
          runs agree within 1%, so the answer is a close numerical
          approximation, not a proven global optimum.
        </p>
      </Section>

      <Section title="Assumptions and limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Historical supply is treated as demand.</strong>{" "}The EIA
            data records what was generated, not what was needed; the model
            assumes those were equal (the grid didn&rsquo;t experience
            unrecorded shortfalls in 2020&ndash;2025).
          </li>
          <li>
            <strong>No transmission between regions.</strong>{" "}Each of the 13
            regions is optimized independently. A region can&rsquo;t import
            cheap wind from its neighbor at 3am — every region has to solve
            its own supply problem in isolation.
          </li>
          <li>
            <strong>Hydro, oil, and &ldquo;other&rdquo; aren&rsquo;t
            optimized.</strong>{" "}They&rsquo;re assumed to scale with demand
            growth exactly as historically observed, and are excluded from
            the build/dispatch decision entirely.
          </li>
          <li>
            <strong>One battery, grid-scale.</strong>{" "}Storage is modeled as a
            single aggregate battery per region (round-trip efficiency and
            hours-at-rated-power from{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              Specs.csv
            </code>
            ), not specific technologies, siting, or transmission-level
            constraints.
          </li>
          <li>
            <strong>Historical weather repeats.</strong>{" "}Each simulated
            year reuses the same 2020&ndash;2025 hourly capacity-factor
            patterns for solar and wind. The model doesn&rsquo;t project
            future weather, climate change effects on renewable output, or
            extreme-weather grid stress.
          </li>
          <li>
            <strong>No sub-hourly dynamics.</strong>{" "}Frequency regulation,
            ramping constraints, and anything faster than an hourly time step
            are out of scope.
          </li>
          <li>
            <strong>Straight-line demand growth.</strong>{" "}Demand grows by a
            constant yearly multiplier — there&rsquo;s no explicit modeling
            of electrification (EVs, heat pumps) as a distinct demand driver,
            though a higher growth rate can stand in for it.
          </li>
        </ul>
      </Section>

      <Section title="Cost and data sources">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Hourly generation data</strong>: US Energy Information
            Administration (EIA) API, per-region hourly fuel-type generation,
            January 2020&ndash;December 2025.
          </li>
          <li>
            <strong>Capital costs</strong>: EIA Annual Energy Outlook 2025
            capital cost assumptions, cross-checked against the IEA/NEA{" "}
            <em>Projected Costs of Generating Electricity 2020</em> report.
          </li>
          <li>
            <strong>Plant lifetimes, fixed/variable O&amp;M, CO₂ intensity,
            and per-source build-rate caps</strong>{" "}are maintained in the
            underlying engine&rsquo;s spec sheet and applied identically
            across all 13 regions.
          </li>
        </ul>
      </Section>

      <Section title="Determinism and versioning">
        <p>
          Every pre-computed result records the engine version, spec-sheet
          version, and EIA data version it was generated with. Comparing two
          scenarios generated under different versions of any of the three
          may reflect a change in assumptions, not just the policy knobs you
          changed — the Compare view is only an apples-to-apples comparison
          when those versions match.
        </p>
      </Section>

      <Section title="Source and license">
        <p>
          This site is built around the modeling engine and data pipeline
          from{" "}
          <a
            href="https://github.com/cliffgold/Optimize"
            className="underline"
          >
            cliffgold/Optimize
          </a>
          . As of this writing, that repository does not specify an open
          source license; treat the underlying model and data accordingly.
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
