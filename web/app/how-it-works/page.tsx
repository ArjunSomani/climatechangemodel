import Link from "next/link";

export const metadata = {
  title: "How It Works — Optimize",
  description: "How the grid decarbonization model works, in plain terms.",
};

function Icon({
  name,
  className,
}: {
  name: keyof typeof ICONS;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

const ICONS = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
    </>
  ),
  wind: (
    <>
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <path d="M12 12 4.5 9.5a3 3 0 1 1 2-5.6" />
      <path d="M12 12 16 4.5a3 3 0 1 1 5.6 2" />
      <path d="M12 12 9.5 19.5a3 3 0 1 0 5.6-2" />
    </>
  ),
  nuclear: (
    <>
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
    </>
  ),
  flame: (
    <path d="M12 2.5c1 3-3.5 3.8-3.5 8a3.5 3.5 0 0 0 7 0c0-1.4-.7-2-1.2-2.9.9.2 2.7 1.6 2.7 4.9a5 5 0 1 1-10 0c0-4.8 3.2-5.6 5-10Z" />
  ),
  coal: (
    <>
      <path d="M3 19h18l-2.5-8h-13L3 19Z" />
      <path d="M8 11l1.5-3.5M12.5 11 14 7.5M17 11l-1-3.5" />
    </>
  ),
  battery: (
    <>
      <rect x="3" y="7" width="16" height="10" rx="1.5" />
      <path d="M21 10v4" />
      <path d="M9 9.5 7 12.5h2.6L8 15" />
    </>
  ),
  retire: (
    <>
      <path d="M4 21V10.5L12 4l8 6.5V21" />
      <path d="M9 21v-6h6v6" />
      <path d="m5 8 14 8" />
    </>
  ),
  grow: (
    <>
      <path d="M4 17 10 11l4 4 6-7" />
      <path d="M15 8h5v5" />
    </>
  ),
  optimize: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1" />
      <circle cx="13" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  cash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M5.5 6v0M18.5 18v0" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  city: (
    <>
      <path d="M4 21V9l5-3v15M13 21V5l7 4v12" />
      <path d="M7 12h0M7 16h0M16 12h0M16 16h0" strokeWidth={2.4} />
    </>
  ),
  bank: (
    <>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" />
      <path d="M3 21h18" />
    </>
  ),
} as const;

const SOURCES: { icon: keyof typeof ICONS; label: string }[] = [
  { icon: "sun", label: "Solar" },
  { icon: "wind", label: "Wind" },
  { icon: "nuclear", label: "Nuclear" },
  { icon: "flame", label: "Gas" },
  { icon: "coal", label: "Coal" },
  { icon: "battery", label: "Battery" },
];

const STEPS: { icon: keyof typeof ICONS; title: string; body: string }[] = [
  {
    icon: "retire",
    title: "Old plants retire",
    body: "Every source loses a slice of its capacity each year — older, longer-lived plants (like nuclear) lose less than younger ones.",
  },
  {
    icon: "grow",
    title: "Demand grows",
    body: "The region needs more electricity than last year, by a set growth rate.",
  },
  {
    icon: "optimize",
    title: "The optimizer decides what to build",
    body: "For each source, it picks how much new capacity to add — whatever combination keeps costs lowest.",
  },
  {
    icon: "bolt",
    title: "The grid runs, hour by hour",
    body: "Cheapest power goes first. Leftover power charges the battery; shortfalls draw it down. Anything still unmet is an outage.",
  },
  {
    icon: "cash",
    title: "The bill gets tallied",
    body: "Building, running, and any outages all cost money. The optimizer keeps adjusting until it finds the cheapest year.",
  },
];

const KNOBS: { icon: keyof typeof ICONS; title: string; body: string }[] = [
  {
    icon: "globe",
    title: "CO₂ price",
    body: "A price on carbon pollution that climbs every year, making gas and coal steadily more expensive.",
  },
  {
    icon: "city",
    title: "Demand growth",
    body: "How much more electricity the region needs each year.",
  },
  {
    icon: "bank",
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
            className="flex w-20 flex-col items-center gap-2 rounded-xl bg-white px-2 py-3 shadow-sm dark:bg-zinc-800"
          >
            <Icon name={s.icon} className="h-7 w-7 text-orange-600 dark:text-orange-400" />
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
              <Icon name={k.icon} className="h-6 w-6 text-orange-600 dark:text-orange-400" />
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white dark:bg-orange-500">
                  <Icon name={step.icon} className="h-5 w-5" />
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
