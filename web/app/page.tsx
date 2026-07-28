import Link from "next/link";

// Static landing page: the intro and four ways in, no charts. (Dropping the
// live teaser also makes this page static/prerendered rather than fetching the
// library on every request.)

const ENTRIES: {
  href: string;
  title: string;
  body: string;
  primary?: boolean;
}[] = [
  {
    href: "/how-it-works",
    title: "How it works",
    body: "The model in plain terms — data, knobs, and what happens each year.",
  },
  {
    href: "/compare",
    title: "Sample comparisons",
    body: "See carbon pricing vs. mortality pricing side by side.",
  },
  {
    href: "/library",
    title: "Browse scenarios",
    body: "Pre-run results across 13 US regions and a range of policies.",
  },
  {
    href: "/custom-run",
    title: "Create your own scenario",
    body: "Pick a carbon and mortality price and watch the cheapest grid change.",
    primary: true,
  },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent)",
        }}
      />
      <div className="mx-auto max-w-3xl px-6 pt-20 pb-24 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          Hourly grid optimization · 25-year horizon
        </p>
        <h1 className="font-display mt-4 text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          The cheapest way to decarbonize the US electricity grid
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          An hourly optimizer picks the lowest-cost mix of solar, wind, nuclear,
          gas, coal, and storage to meet demand every hour, for 25 years, under
          whatever policy scenario you throw at it.
        </p>
        <p className="mx-auto mt-5 max-w-xl text-base text-zinc-600 dark:text-zinc-400">
          It prices{" "}
          <span className="text-zinc-800 dark:text-zinc-200">two</span> harms the
          market ignores — carbon <em>and</em> mortality. Per unit of energy,
          coal is more than 1,000× deadlier than solar;{" "}
          <Link href="/safety" className="underline hover:text-accent">
            see the risk ladder
          </Link>
          .
        </p>

        <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
          {ENTRIES.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className={
                "group flex flex-col rounded-xl border p-5 transition-colors " +
                (e.primary
                  ? "border-accent bg-accent/5 hover:bg-accent/10"
                  : "border-zinc-200 hover:border-accent/50 dark:border-zinc-800")
              }
            >
              <span className="font-display flex items-center gap-1.5 text-lg font-medium text-black dark:text-zinc-50">
                {e.title}
                <span
                  aria-hidden
                  className="text-accent transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </span>
              <span className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                {e.body}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
