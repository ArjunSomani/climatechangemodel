import Link from "next/link";
import { DivergenceComparison } from "@/components/DivergenceComparison";
import { FindingsDeathBars } from "@/components/FindingsDeathBars";
import { Term } from "@/components/Term";
import { formatVsl } from "@/lib/mortality";
import latticeData from "@/data/playground_lattice.json";
import type { Lattice } from "@/lib/playground";
import { KeyPoint } from "@/components/KeyPoint";
import { ChartCaption } from "@/components/ChartCaption";

export const metadata = {
  title: "What we found — Optimize",
  description:
    "Three results from the coal-heavy Midwest grid: pricing either carbon or mortality collapses coal and cuts grid deaths ~95%, the two prices then diverge on gas, and carbon pricing reaches fewer deaths than mortality pricing does.",
};

// Every number on this page is read from the same pre-computed lattice the
// playground and DivergenceComparison use, at build time -- so the narrative,
// the stat cards, and the embedded chart can never disagree. Deaths come from
// the lattice's deathsCentral (computed web-side from generation x coefficient,
// mortality.ts); we never touch the engine's inflated raw CO2 field.
const lattice = latticeData as Lattice;
const CARBON_HI = lattice.carbonPrices.length - 1;
// Snap to the published high VSL ($21.5M), matching DivergenceComparison, so
// every regime stays inside HHS's range.
const MORT_HI = lattice.mortalityPrices.reduce(
  (best, p, i, arr) =>
    Math.abs(p - 21_500_000) < Math.abs(arr[best] - 21_500_000) ? i : best,
  0
);

const carbonPrice = lattice.carbonPrices[CARBON_HI];
const mortPrice = lattice.mortalityPrices[MORT_HI];

const none = lattice.cells["0_0"];
const carbon = lattice.cells[`${CARBON_HI}_0`];
const mort = lattice.cells[`0_${MORT_HI}`];

const baselineDeaths = Math.round(none.deathsCentral);
const carbonDeaths = Math.round(carbon.deathsCentral);
const mortDeaths = Math.round(mort.deathsCentral);

// Conservative (smaller) collapse across the two single-price regimes.
const collapsePct = Math.round(
  100 * (1 - Math.max(carbonDeaths, mortDeaths) / baselineDeaths)
);

function twh(mwh: number): number {
  return Math.round((mwh ?? 0) / 1_000_000);
}

const coalNone = twh(none.finalMixMWh.Coal ?? 0);
const gasCarbon = twh(carbon.finalMixMWh.Gas ?? 0);
const gasMort = twh(mort.finalMixMWh.Gas ?? 0);
const gasFactor = (gasMort / Math.max(1, gasCarbon)).toFixed(1);

export default function FindingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance">
        Pricing a harm collapses coal. <em>Which</em> harm changes the rest.
      </h1>
      <p className="mt-5 text-lg text-zinc-600 dark:text-zinc-400">
        We ran the coal-heavy Midwest ({lattice.region}) over{" "}
        {lattice.years} years, pricing two externalities the electricity market
        never charges for — carbon and mortality — and watched the cheapest grid
        change. Three results came out, and they build on each other: one
        robust, one subtle, one genuinely counterintuitive.
      </p>

      <KeyPoint label="The payoff:">
        putting a price on <em>either</em> harm cleans up the grid — but the two
        prices disagree about gas, and that disagreement means the externality
        you choose to price quietly changes the final death toll. It is not a
        wash.
      </KeyPoint>

      {/* ---- Finding 1 -------------------------------------------------- */}
      <section className="mt-14">
        <FindingHeading n={1}>
          Price <em>either</em> harm, and coal collapses
        </FindingHeading>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          With no price on either externality, the cheapest grid keeps burning{" "}
          <span style={{ color: "var(--series-coal-text)" }} className="font-medium">
            coal
          </span>{" "}
          — about {coalNone} TWh of it in the final year — and kills roughly{" "}
          <strong className="text-black dark:text-zinc-50">
            {baselineDeaths.toLocaleString()}
          </strong>{" "}
          people a year. Turn on <em>either</em> price — a ${carbonPrice}/ton
          carbon price or a {formatVsl(mortPrice)} mortality price — and coal
          all but vanishes. Grid deaths fall about{" "}
          <strong className="text-black dark:text-zinc-50">{collapsePct}%</strong>
          . It barely matters which harm you charge for. This is the robust
          headline.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <DeathStat label="No pricing" value={baselineDeaths} tone="bad" />
          <DeathStat label={`Carbon $${carbonPrice}`} value={carbonDeaths} />
          <DeathStat
            label={`Mortality ${formatVsl(mortPrice)}`}
            value={mortDeaths}
          />
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <ChartCaption className="mb-3">
            Coal in the final-year mix
          </ChartCaption>
          <GenBar label="No pricing" value={coalNone} max={coalNone} />
          <GenBar label={`Carbon $${carbonPrice}`} value={twh(carbon.finalMixMWh.Coal ?? 0)} max={coalNone} />
          <GenBar
            label={`Mortality ${formatVsl(mortPrice)}`}
            value={twh(mort.finalMixMWh.Coal ?? 0)}
            max={coalNone}
          />
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Coal goes from {coalNone} TWh to essentially zero under either price.
            The <Link href="/safety" className="underline hover:text-accent">risk ladder</Link>{" "}
            explains why it&apos;s coal that takes the hit: per unit of energy
            it&apos;s the deadliest source by a wide margin, and the carbon-heaviest.
          </p>
        </div>
      </section>

      {/* ---- Finding 2 -------------------------------------------------- */}
      <section className="mt-14">
        <FindingHeading n={2}>
          But the two prices diverge on{" "}
          <span style={{ color: "var(--series-gas-text)" }}>gas</span>
        </FindingHeading>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          Coal exits under either price — that part is agreement. The interesting
          part is where they disagree. A carbon price drives{" "}
          <span style={{ color: "var(--series-gas-text)" }} className="font-medium">
            gas
          </span>{" "}
          down to about {gasCarbon} TWh; a mortality price leaves roughly{" "}
          {gasMort} TWh standing — about {gasFactor}× as much. The reason is that{" "}
          gas is <Term definition="Per unit of energy, gas emits roughly half as much CO2 as coal but causes far fewer deaths -- it is much cleaner on mortality than on carbon. So a mortality price barely leans on gas, while a carbon price leans on it hard.">
            carbon-heavy but comparatively low-mortality
          </Term>
          : a carbon price leans on it hard, a mortality price barely touches it.
          Over the full {lattice.years}-year horizon that difference reaches the{" "}
          <em>built</em> mix, not just the marginal cost.
        </p>

        <div className="mt-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <ChartCaption className="mb-3">
            Coal exits under either price — but gas is where they diverge
          </ChartCaption>
          <DivergenceComparison />
        </div>
      </section>

      {/* ---- Finding 3 -------------------------------------------------- */}
      <section className="mt-14">
        <FindingHeading n={3}>
          Carbon pricing reaches <em>fewer</em> deaths here
        </FindingHeading>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          Here is the counterintuitive one. You&apos;d expect the{" "}
          <em>mortality</em> price — the one built to save lives — to reach the
          fewest deaths. It doesn&apos;t. In this region the{" "}
          <em>carbon</em> price lands on{" "}
          <strong className="text-black dark:text-zinc-50">
            {carbonDeaths}
          </strong>{" "}
          deaths a year versus the mortality price&apos;s{" "}
          <strong className="text-black dark:text-zinc-50">{mortDeaths}</strong>{" "}
          — because it squeezes the surviving gas so much harder, and gas still
          kills. Optimizing for one harm overshoots on the other.
        </p>

        <div className="mt-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <ChartCaption className="mb-3">
            Annual grid deaths, carbon price vs. mortality price
          </ChartCaption>
          <FindingsDeathBars
            rows={[
              {
                label: `Carbon $${carbonPrice}`,
                sublabel: `gas ${gasCarbon} TWh`,
                deaths: carbonDeaths,
                note: "fewer deaths",
              },
              {
                label: `Mortality ${formatVsl(mortPrice)}`,
                sublabel: `gas ${gasMort} TWh`,
                deaths: mortDeaths,
              },
            ]}
          />
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Both are a ~{collapsePct}% cut from the {baselineDeaths.toLocaleString()}
            -deaths baseline — the gap between them is small against that drop.
            But it points the wrong way from intuition: the harm you price is not
            necessarily the harm you minimize.
          </p>
        </div>
      </section>

      {/* ---- Payoff ----------------------------------------------------- */}
      <section className="mt-14">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
          {/* Real heading, so the page's closing argument appears in the
              document outline instead of only reading as a styled label. */}
          <h2 className="text-xl font-medium text-[var(--mortality)]">
            The thesis
          </h2>
          <p className="mt-2 text-lg text-zinc-800 dark:text-zinc-200">
            Which externality you price is not a cosmetic choice. Any price cleans
            up coal — but carbon and mortality are different instruments that reach
            different grids, and here the carbon price reaches fewer deaths than
            the mortality price does. So <em>which harm you charge for</em> is a
            real decision with a non-obvious answer, not a formality.
          </p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            These numbers are one region at one pair of prices. Move both sliders
            yourself in the{" "}
            <Link href="/playground" className="underline hover:text-accent">
              playground
            </Link>
            , see why mortality and coal are priced the way they are on the{" "}
            <Link href="/safety" className="underline hover:text-accent">
              safety page
            </Link>
            , or price both harms on a region of your choice in a{" "}
            <Link href="/custom-run" className="underline hover:text-accent">
              custom run
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

// The three findings genuinely are a sequence -- the deck promises "one robust,
// one subtle, one genuinely counterintuitive" and each builds on the last -- so
// an ordinal is information, not decoration. Two things were wrong with how it
// was shown:
//
//   1. `01 / 02 / 03` is the zero-padded landing-page convention, which reads as
//      template scaffolding rather than as a numbered argument.
//   2. It was a decorative <span> *outside* the <h2>, at text-zinc-300 on
//      near-white -- 1.44:1, effectively invisible. So the sequence was announced
//      to nobody: sighted readers couldn't see it, and screen readers never got
//      it because it wasn't part of the heading.
//
// Now the ordinal lives inside the heading as real, legible text.
function FindingHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-baseline gap-3 text-xl font-medium">
      <span className="text-2xl text-zinc-500 tabular-nums dark:text-zinc-400">
        {n}
      </span>
      <span>{children}</span>
    </h2>
  );
}

function DeathStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "bad";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 py-3 dark:border-zinc-800">
      <div
        className="font-sans text-2xl font-semibold tabular-nums"
        style={tone === "bad" ? { color: "var(--mortality)" } : undefined}
      >
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="text-[10px] tracking-wide text-zinc-500 dark:text-zinc-400 uppercase">
        deaths / yr
      </div>
    </div>
  );
}

// Coal generation in the final-year mix, one hue (var(--series-coal), coal's
// identity color), value direct-labelled. Bars share one scale (max = the
// no-pricing bar) so the collapse is read by length.
function GenBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = value <= 0 ? 0 : Math.max(1.5, (value / max) * 100);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-40 shrink-0 text-sm font-medium">{label}</span>
      <div className="h-5 flex-1">
        <div
          className="h-full rounded-sm"
          style={{ width: `${pct}%`, background: "var(--series-coal)" }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-sm tabular-nums">
        {value} <span className="text-zinc-500 dark:text-zinc-400">TWh</span>
      </span>
    </div>
  );
}
