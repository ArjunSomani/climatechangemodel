import Link from "next/link";
import { Standfirst } from "@/components/Standfirst";

// Static landing page: the intro and three ways in, no charts. (Dropping the
// live teaser also makes this page static/prerendered rather than fetching the
// library on every request.)

type Entry = { href: string; title: string; body: string };

// The one action the page is for.
const PRIMARY: Entry = {
  href: "/custom-run",
  title: "Run your own scenario",
  body: "Pick a carbon and mortality price and watch the cheapest grid change.",
};

// Everything else: reading and browsing, ordered easiest-first.
const SECONDARY: Entry[] = [
  {
    href: "/how-it-works",
    title: "How it works",
    body: "The model in plain terms — data, knobs, and what happens each year.",
  },
  {
    href: "/compare",
    title: "Sample comparisons",
    body: "Carbon pricing vs. mortality pricing, side by side.",
  },
  {
    href: "/library",
    title: "Browse scenarios",
    body: "Pre-run results across 13 US regions and a range of policies.",
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
        <Standfirst>Hourly grid optimization · 25-year horizon</Standfirst>
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

        {/* Four routes in, but they were never four peers: one is the thing we
            want you to do, one explains the model, two are ways to browse
            pre-computed output. Rendering them as a 2x2 of identically sized
            bordered cards flattened that into "pick any of four," which is both
            the most template-looking layout available and a worse answer to
            "where do I start?" -- so the hierarchy is now the layout. */}
        <div className="mt-10">
          <Link
            href={PRIMARY.href}
            className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-medium text-accent-foreground"
          >
            {PRIMARY.title}
            <span
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
          <p className="mx-auto mt-3 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
            {PRIMARY.body}
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-xl border-t border-zinc-200 text-left dark:border-zinc-800">
          <h2 className="mt-6 text-center text-base font-medium text-zinc-600 dark:text-zinc-400">
            Or start from what&apos;s already been run
          </h2>
          <ul className="mt-2">
            {SECONDARY.map((e) => (
              <li
                key={e.href}
                className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800"
              >
                <Link
                  href={e.href}
                  className="group flex items-baseline gap-3 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  <span className="font-display w-40 shrink-0 text-base font-medium text-black dark:text-zinc-50">
                    {e.title}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {e.body}
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 text-accent transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
