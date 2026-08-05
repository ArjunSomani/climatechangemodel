import Link from "next/link";
import { RiskLadder } from "@/components/RiskLadder";
import { DivergenceComparison } from "@/components/DivergenceComparison";
import { SafetyFaq } from "@/components/SafetyFaq";
import { MorbidityUplift } from "@/components/MorbidityUplift";
import { Term } from "@/components/Term";
import {
  MoralChoiceNote,
  AttributionNote,
  CountedModeledNote,
} from "@/components/SafetyDisclosure";
import { MORTALITY, VSL_PRESETS, formatVsl } from "@/lib/mortality";
import latticeData from "@/data/playground_lattice.json";
import type { Lattice } from "@/lib/playground";
import { KeyPoint } from "@/components/KeyPoint";
import { Standfirst } from "@/components/Standfirst";
import { ChartCaption } from "@/components/ChartCaption";

const VSL_CENTRAL = 14_100_000;
// deaths/TWh × $/death ÷ 1e6 MWh/TWh = $/MWh of mortality cost.
const coalMortalityPerMwh = Math.round(
  (MORTALITY.coal.central * VSL_CENTRAL) / 1_000_000
);
const gasMortalityPerMwh = Math.round(
  (MORTALITY.gas.central * VSL_CENTRAL) / 1_000_000
);

// Headline numbers, straight from the pre-computed grid (same source as the
// comparison lower down), so the lead result and the chart never disagree.
const lattice = latticeData as Lattice;
const CARBON_HI = lattice.carbonPrices.length - 1;
const MORT_HI = lattice.mortalityPrices.reduce(
  (best, p, i, arr) =>
    Math.abs(p - 21_500_000) < Math.abs(arr[best] - 21_500_000) ? i : best,
  0
);
const baselineDeaths = Math.round(lattice.cells["0_0"].deathsCentral);
const carbonDeaths = Math.round(lattice.cells[`${CARBON_HI}_0`].deathsCentral);
const mortDeaths = Math.round(lattice.cells[`0_${MORT_HI}`].deathsCentral);
// Conservative (smaller) collapse of the two single-price regimes.
const collapsePct = Math.round(
  100 * (1 - Math.max(carbonDeaths, mortDeaths) / baselineDeaths)
);

export const metadata = {
  title: "Safety & mortality — Optimize",
  description:
    "Electricity kills people — unevenly. How Optimize prices mortality as a second externality alongside carbon.",
};

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Standfirst>The second externality</Standfirst>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance">
        Electricity kills people — unevenly
      </h1>
      <p className="mt-5 text-lg text-zinc-600 dark:text-zinc-400">
        Every source of power carries a death toll: mining and drilling
        accidents, and — far larger — the air pollution that shortens lives
        downwind. Per unit of energy, coal is{" "}
        <span className="font-semibold text-black dark:text-zinc-50">
          more than 1,000×
        </span>{" "}
        deadlier than solar — three orders of magnitude. The electricity market
        never charges for any of it. Optimize lets you put a price on it.
      </p>

      <KeyPoint label="In one line:">
        electricity kills people, very unevenly, and the market never charges
        for it — so we let you charge for it and watch the cheapest grid change.
      </KeyPoint>

      <section className="mt-10">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          {/* A real heading, not a 12px uppercase tracked pseudo-label: this
              panel is the most important thing on the page and had no entry in
              the document outline at all. */}
          <h2 className="text-xl font-medium text-[var(--mortality)]">
            The headline result
          </h2>
          <p className="mt-2 text-lg text-zinc-800 dark:text-zinc-200">
            Put a price on <em>either</em> harm — carbon or mortality — and the
            coal-heavy Midwest is transformed: coal collapses and grid deaths
            fall about{" "}
            <strong className="text-black dark:text-zinc-50">
              {collapsePct}%
            </strong>
            , from ~{baselineDeaths.toLocaleString()} to a few dozen a year. It
            barely matters <em>which</em> harm you price.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <DeathStat label="No pricing" value={baselineDeaths} tone="bad" />
            <DeathStat
              label={`Carbon $${lattice.carbonPrices[CARBON_HI]}`}
              value={carbonDeaths}
            />
            <DeathStat
              label={`Mortality ${formatVsl(lattice.mortalityPrices[MORT_HI])}`}
              value={mortDeaths}
            />
          </div>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            The subtler, more interesting part is the second act — where the two
            prices <em>disagree</em>. They part ways on{" "}
            <span
              style={{ color: "var(--series-gas-text)" }}
              className="font-medium"
            >
              gas
            </span>
            ,{" "}
            <a href="#divergence" className="underline hover:text-accent">
              shown below
            </a>
            .
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-medium">The risk ladder</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          <Term definition="Deaths per terawatt-hour (TWh) of electricity — a TWh is roughly the annual power of 93,000 US homes. Lets you compare sources fairly regardless of how much each one generates.">
            Deaths per terawatt-hour
          </Term>
          , by source. The scale is logarithmic — each step is a multiple, not
          an addition — because the sources span three orders of magnitude.
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
          The most surprising number: nuclear
        </h2>
        <div className="mt-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <CompareBar
            label="Coal"
            value={MORTALITY.coal.central}
            max={MORTALITY.coal.central}
            colorVar="--series-coal"
          />
          <CompareBar
            label="Nuclear"
            value={MORTALITY.nuclear.central}
            max={MORTALITY.coal.central}
            colorVar="--series-nuclear"
          />
          <p className="mt-3 text-center text-sm font-medium">
            hundreds of times safer than coal —{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              accidents included
            </span>
          </p>
        </div>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Nuclear&apos;s {MORTALITY.nuclear.central} deaths/TWh counts every
          death from every accident — Chernobyl and Fukushima among them. The
          toll from electricity is dominated by coal&apos;s everyday air
          pollution, not by rare disasters.
        </p>
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
          They don&apos;t fully agree. Coal exits under either. Gas is where they
          part ways — ~9× cleaner than coal on deaths but only ~1.7× cleaner on
          CO₂, so per MWh a mortality price barely touches gas while a carbon
          price leans on it hard. Over the full 25-year horizon that difference
          reaches the <em>built</em> mix: a carbon price drives gas far lower
          than a mortality price does (
          <a href="#divergence" className="underline hover:text-accent">
            shown below
          </a>
          ). Move both sliders in the{" "}
          <Link href="/playground" className="underline hover:text-accent">
            playground
          </Link>{" "}
          to explore.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-medium">What is a life worth?</h2>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          To price mortality you need a dollar value per death — a{" "}
          <Term definition="Value of a Statistical Life: the dollar figure at which a large population's willingness to pay to reduce risk implies one avoided death. It is a statistical aggregate, not a valuation of any specific person.">
            <em>value of a statistical life</em> (VSL)
          </Term>
          . HHS&apos;s 2026 regulatory guidance publishes a range, not a single
          number (constant 2025 dollars):
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {VSL_PRESETS.map((p) => (
            <div
              key={p.label}
              className="rounded-xl border border-zinc-200 py-4 dark:border-zinc-800"
            >
              <div className="font-sans text-2xl font-semibold tabular-nums">
                {formatVsl(p.value)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {p.label}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-zinc-700 dark:text-zinc-300">
          That number comes from{" "}
          <span className="font-medium">what people actually pay to avoid risk</span>{" "}
          — wage premiums for dangerous jobs, spending on safety — scaled up to
          one statistical death. It is <span className="font-medium">not the
          price of your life</span>, or anyone&apos;s in particular.
        </p>
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
          Deaths are reported as a{" "}
          <span className="font-medium">
            central estimate with a high-side band
          </span>
          , never a single figure. The band is real scientific uncertainty from
          two independent places: how deadly each source is (coal&apos;s
          air-pollution toll is <em>modeled</em>, not counted), and what a life
          is worth (the VSL is itself a low/central/high range). A
          priced-mortality cost inherits both — so any dollar figure that
          includes mortality is a band too. The honest read is the width, not
          the midpoint.{" "}
          <Link href="/methodology" className="underline hover:text-accent">
            How the bands are built →
          </Link>
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-medium">Deaths are only part of the harm</h2>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          The health toll of burning fossil fuels isn&apos;t only fatal. For every
          death there are far more non-fatal harms — asthma attacks, heart and
          lung hospitalizations, lost workdays — that this model doesn&apos;t
          price. Counting deaths alone therefore <em>understates</em> the burden.
          The control below makes that explicit: it doesn&apos;t change the
          model, it shows how much larger the monetized health cost would be if
          morbidity were added on top.
        </p>
        <div className="mt-4">
          <MorbidityUplift />
        </div>
      </section>

      <section id="divergence" className="mt-12 scroll-mt-20">
        <h2 className="text-xl font-medium">
          What pricing mortality actually does
        </h2>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          Take a coal-heavy region and set the mortality price to the central
          VSL, {formatVsl(VSL_CENTRAL)}. Here is what the optimizer now sees:
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ParallelCard
            title="Coal"
            unit={`~$${coalMortalityPerMwh}/MWh`}
            body={`Coal's ${MORTALITY.coal.central} deaths/TWh, priced at the central VSL, adds about $${coalMortalityPerMwh} per MWh — many times what it costs to actually run the plant (a few tens of dollars). Coal can't compete, and the optimizer stops rebuilding it.`}
          />
          <ParallelCard
            title="Gas"
            unit={`~$${gasMortalityPerMwh}/MWh`}
            body={`Gas's ${MORTALITY.gas.central} deaths/TWh adds only about $${gasMortalityPerMwh} per MWh — comparable to its running cost, not a knockout. Gas takes a hit but survives, and often fills in as coal leaves.`}
          />
        </div>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          That&apos;s the disagreement in one comparison: per MWh, the same price
          is a death sentence for coal and a tax for gas. A carbon price, which
          sees coal and gas as far more alike, weighs them differently.
        </p>

        <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <ChartCaption className="mb-3">
            Coal exits under either price — but gas is where they diverge
          </ChartCaption>
          <DivergenceComparison />
        </div>
      </section>

      <details className="group mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xl font-medium marker:content-none">
          Where these numbers come from
          <span aria-hidden className="text-base text-zinc-500 dark:text-zinc-400 transition group-open:rotate-45">
            +
          </span>
        </summary>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          Optimize does not invent death rates. They are imported from{" "}
          <a
            href="https://levelmodel.vercel.app"
            className="underline hover:text-accent"
            target="_blank"
            rel="noreferrer"
          >
            Level
          </a>
          , which draws on{" "}
          <a
            href="https://ourworldindata.org/safest-sources-of-energy"
            className="underline hover:text-accent"
            target="_blank"
            rel="noreferrer"
          >
            Our World in Data&apos;s analysis of the safest sources of energy
          </a>
          . That analysis compiles the published epidemiological literature —
          air-pollution mortality from concentration-response studies, and
          accident death tolls from energy-accident databases. Optimize is not a
          second source of truth for these figures; every coefficient on this
          site links back to its Level source page, and Level to the original
          research.
        </p>
      </details>

      <details className="group mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xl font-medium marker:content-none">
          What could make these numbers wrong
          <span aria-hidden className="text-base text-zinc-500 dark:text-zinc-400 transition group-open:rotate-45">
            +
          </span>
        </summary>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          Stated plainly, because pretending otherwise would be the real error:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
          <li>
            <strong>They&apos;re global averages.</strong>{" "}US coal with modern
            scrubbers is likely somewhat safer than the global fleet these
            figures describe. Trust the <em>ranking</em> more than any decimal.
          </li>
          <li>
            <strong>Air-pollution death is modeled, not counted.</strong>{" "}The
            bulk of the toll comes from statistical attribution, which depends on
            exposure and dose-response assumptions that reasonable experts
            dispute — hence the wide upper bands.
          </li>
          <li>
            <strong>Future deaths aren&apos;t discounted.</strong>{" "}A death in
            2050 is weighted the same as one today; a different choice would
            change priced costs.
          </li>
          <li>
            <strong>VSL is contested.</strong>{" "}The very idea, and the specific
            number, are debated on ethical and methodological grounds. That
            debate is the point — it&apos;s why the price is yours to set.
          </li>
        </ul>
      </details>

      <section className="mt-12">
        <h2 className="text-xl font-medium">Where the deaths land</h2>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          CO₂ is global; air-pollution deaths are local. Optimize reports{" "}
          <span className="font-medium">production-based</span> deaths, attributed
          to the region that generated the power. The model optimizes each region
          on its own and holds transmission between regions at its historical
          level, so it doesn&apos;t track where power ends up — a consumption-based
          view (deaths where the power is <em>used</em>) would need an explicit
          inter-regional flow model.{" "}
          <Link href="/methodology" className="underline hover:text-accent">
            Why, and what would change it →
          </Link>
        </p>
        <div className="mt-4">
          <AttributionNote />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-medium">Questions people ask</h2>
        <div className="mt-4">
          <SafetyFaq />
        </div>
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

function CompareBar({
  label,
  value,
  max,
  colorVar,
}: {
  label: string;
  value: number;
  max: number;
  colorVar: string;
}) {
  const pct = Math.max(0.6, (value / max) * 100);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-16 shrink-0 text-sm font-medium">{label}</span>
      <div className="h-5 flex-1">
        <div
          className="h-full rounded-sm"
          style={{ width: `${pct}%`, background: `var(${colorVar})` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-sm tabular-nums">
        {value} <span className="text-zinc-500 dark:text-zinc-400">/TWh</span>
      </span>
    </div>
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
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {unit}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}
