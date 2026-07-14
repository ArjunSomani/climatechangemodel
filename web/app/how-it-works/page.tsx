import Link from "next/link";

export const metadata = {
  title: "How It Works — Optimize",
  description: "How the grid decarbonization model works, in plain terms.",
};

const SOURCES = [
  { icon: "☀️", label: "Solar" },
  { icon: "🌬️", label: "Wind" },
  { icon: "⚛️", label: "Nuclear" },
  { icon: "🔥", label: "Gas" },
  { icon: "⛏️", label: "Coal" },
  { icon: "🔋", label: "Battery" },
];

const STEPS = [
  {
    icon: "🏚️",
    title: "Old plants retire",
    body: "Every source loses a slice of its capacity each year — older, longer-lived plants (like nuclear) lose less than younger ones.",
  },
  {
    icon: "📈",
    title: "Demand grows",
    body: "The region needs more electricity than last year, by a set growth rate.",
  },
  {
    icon: "🧮",
    title: "The optimizer decides what to build",
    body: "For each source, it picks how much new capacity to add — whatever combination keeps costs lowest.",
  },
  {
    icon: "⚡",
    title: "The grid runs, hour by hour",
    body: "Cheapest power goes first. Leftover power charges the battery; shortfalls draw it down. Anything still unmet is an outage.",
  },
  {
    icon: "💵",
    title: "The bill gets tallied",
    body: "Building, running, and any outages all cost money. The optimizer keeps adjusting until it finds the cheapest year.",
  },
];

const KNOBS = [
  {
    icon: "🌍",
    title: "CO₂ price",
    body: "A price on carbon pollution that climbs every year, making gas and coal steadily more expensive.",
  },
  {
    icon: "🏙️",
    title: "Demand growth",
    body: "How much more electricity the region needs each year.",
  },
  {
    icon: "🏦",
    title: "Interest rate",
    body: "The cost of borrowing to build new plants — this can make or break nuclear, which takes decades to pay off.",
  },
];

const GLOSSARY = [
  {
    term: "MW vs. MWh",
    body: "MW is how big a power plant is. MWh is how much energy it actually produced. A big plant that rarely runs still makes little MWh.",
  },
  {
    term: "Capacity factor",
    body: "How often a source actually runs, as a percent of the time. Nuclear: almost always. Solar: only when the sun's out.",
  },
  {
    term: "Outage",
    body: "Electricity demand that went unmet. A well-run scenario keeps this at zero.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        How it works
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Every year, for 27 years, the model asks one question: what&rsquo;s
        the cheapest mix of power sources that still keeps the lights on,
        every hour?
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {SOURCES.map((s) => (
          <div
            key={s.label}
            className="flex w-20 flex-col items-center gap-1 rounded-xl bg-white px-2 py-3 shadow-sm dark:bg-zinc-800"
          >
            <span className="text-3xl" aria-hidden>
              {s.icon}
            </span>
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {s.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-zinc-500 dark:text-zinc-500">
        These six sources compete every year — the model picks how much of
        each to build.
      </p>

      <Section title="Where the data comes from">
        <p>
          The model is grounded in six years of real US electricity data
          (2020&ndash;2025) — nearly 700,000 hourly readings across 13
          regions, broken down by source.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat value="~684K" label="hourly readings" />
          <Stat value="13" label="US regions" />
          <Stat value="6" label="years of data" />
        </div>
      </Section>

      <Section title="The knobs you can turn">
        <p>Three big levers, plus per-source cost dials, shape every run:</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {KNOBS.map((k) => (
            <div
              key={k.title}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="text-2xl" aria-hidden>
                {k.icon}
              </div>
              <div className="mt-2 font-medium text-black dark:text-zinc-50">
                {k.title}
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {k.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What happens every simulated year">
        <div className="mt-2 space-y-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-lg text-white dark:bg-white dark:text-black">
                  <span aria-hidden>{step.icon}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mt-1 h-full w-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                )}
              </div>
              <div className="pb-4">
                <div className="font-medium text-black dark:text-zinc-50">
                  {i + 1}. {step.title}
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Want the math behind each step?{" "}
          <Link href="/methodology" className="underline">
            See the methodology page
          </Link>
          .
        </p>
      </Section>

      <Section title="A few terms you'll see">
        <div className="grid gap-3 sm:grid-cols-3">
          {GLOSSARY.map((g) => (
            <div
              key={g.term}
              className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900"
            >
              <div className="font-medium text-black dark:text-zinc-50">
                {g.term}
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {g.body}
              </p>
            </div>
          ))}
        </div>
        <p>
          Ready to explore? Check out the{" "}
          <Link href="/library" className="underline">
            library
          </Link>{" "}
          of real runs, or{" "}
          <Link href="/compare" className="underline">
            compare
          </Link>{" "}
          two scenarios side by side.
        </p>
      </Section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 py-3 dark:bg-zinc-900">
      <div className="text-xl font-semibold text-black dark:text-zinc-50">
        {value}
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-500">{label}</div>
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
