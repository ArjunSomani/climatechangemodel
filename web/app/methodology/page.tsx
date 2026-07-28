import Link from "next/link";
import { NewHereBanner } from "@/components/NewHereBanner";
import {
  CountedModeledNote,
  MoralChoiceNote,
  AttributionNote,
  UncertaintyBandNote,
} from "@/components/SafetyDisclosure";

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
        This page is the fine print: what the model assumes, where it breaks
        down, and where the numbers come from.
      </p>

      <div className="mt-6">
        <NewHereBanner />
      </div>

      <Section title="What the optimizer actually does">
        <p>
          For each simulated year and region, a Nelder-Mead numerical
          optimizer chooses how much new capacity to add for each of six
          sources (solar, wind, nuclear, gas, coal, battery), bounded by that
          source&rsquo;s maximum build rate. It minimizes total system cost —
          financed capital + fixed O&amp;M for everything installed, variable
          O&amp;M + CO₂ cost + mortality cost for everything generated, plus a
          steep penalty
          for any unmet demand (&ldquo;outage&rdquo;) — subject to meeting
          demand in every one of the ~8,760 hours in the year. The optimizer
          re-runs with progressively tighter tolerances until two consecutive
          runs agree within 1%, so the answer is a close numerical
          approximation, not a proven global optimum.
        </p>
      </Section>

      <Section title="Mortality — the second externality">
        <p>
          Alongside CO₂, the optimizer prices mortality. Each source carries a
          death rate in deaths per TWh (mining and drilling accidents, plus
          air-pollution and radiation deaths downwind); the objective adds one
          linear term,{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            generation × death-rate × mortality-price
          </code>
          , structurally identical to the CO₂ term. A mortality price of zero
          reproduces the original model exactly, so the feature is strictly
          opt-in.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Coefficients come from{" "}
            <a href="https://levelmodel.vercel.app" className="underline">
              Level
            </a>
            .</strong>{" "}They are imported, not re-derived, as a low/central/high
            band per source, and every figure links back to its Level source
            page. Battery carries no direct rate — its harm is embodied in the
            electricity it stores.
          </li>
          <li>
            <strong>The band is uncertainty, not rounding.</strong>{" "}Each
            source&rsquo;s low–central–high spans genuine disagreement in the
            epidemiological literature (coal&rsquo;s from air-pollution exposure
            modeling; hydro&rsquo;s high bound from the 1975 Banqiao failure).
            Deaths sum those ranges across the mix; a priced-mortality cost adds
            the VSL range on top, so it is reported as a band, never a point.
          </li>
          <li>
            <strong>Value of a statistical life (VSL).</strong>{" "}The price per
            death uses HHS&rsquo;s 2026 published range ($6.6M / $14.1M / $21.5M,
            constant 2025 dollars), optionally escalated ~1.1%/yr in real terms.
            Presented as published values, never as endorsement.
          </li>
          <li>
            <strong>Production == consumption here, by construction.</strong>{" "}
            Deaths are assigned to the region that generated the power. Because
            regions are optimized independently with no transmission between
            them, each consumes exactly what it generates, so production- and
            consumption-based mortality are identical. A meaningful
            consumption-based account would require adding inter-regional
            transmission to the optimizer — which would change every result on
            the site, not just the mortality ones.
          </li>
          <li>
            <strong>Mortality only.</strong>{" "}Morbidity, water, land, minerals,
            and equity-weighting are out of scope.
          </li>
        </ul>
        <div className="space-y-2 pt-1">
          <UncertaintyBandNote />
          <CountedModeledNote />
          <AttributionNote />
          <MoralChoiceNote />
        </div>
        <p className="text-sm">
          The full framing lives on the{" "}
          <Link href="/safety" className="underline">
            Safety &amp; mortality
          </Link>{" "}
          page.
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
            <strong>Plant lifetimes, fixed/variable O&amp;M, and per-source
            build-rate caps</strong>{" "}are maintained in the underlying
            engine&rsquo;s spec sheet and applied identically across all 13
            regions.
          </li>
          <li>
            <strong>CO₂ intensity</strong>: per-source emissions factors
            (tonnes CO₂ per MWh) come from the engine&rsquo;s{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              Specs.csv
            </code>{" "}
            spec sheet, applied identically across all 13 regions. These
            per-MWh intensities are consistent with published lifecycle
            emission ranges (e.g. IPCC AR5, EIA), though we don&rsquo;t claim
            an exact one-to-one derivation from any single published source.
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
