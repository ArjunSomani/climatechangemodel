import Link from "next/link";

// Next's built-in not-found page is not just plain -- it actively breaks the
// theme. It injects an UNLAYERED <style> block:
//
//   body{color:#000;background:#fff;margin:0}
//   @media (prefers-color-scheme:dark){body{color:#fff;background:#000}}
//
// Unlayered CSS beats layered CSS regardless of specificity, so that overrides
// `@layer base { body { background: var(--background) } }` in globals.css. And
// it keys off prefers-color-scheme, which this app deliberately does not use --
// the theme is attribute-driven so the in-app toggle can override the OS. Result:
// a visitor with the site in dark mode but a light OS got a white page wearing
// dark-theme chrome, with nav links measured at 2.62:1.
//
// Defining this file means the built-in is never rendered, so the reset never
// ships. It also replaces a dead end with somewhere to go.
export const metadata = {
  title: "Page not found — Optimize",
};

const SUGGESTIONS: { href: string; label: string; body: string }[] = [
  {
    href: "/",
    label: "Start at the beginning",
    body: "What the model does and why it prices two harms instead of one.",
  },
  {
    href: "/library",
    label: "Browse scenarios",
    body: "Pre-run results across 13 US regions.",
  },
  {
    href: "/custom-run",
    label: "Run your own",
    body: "Pick a carbon and mortality price and see the cheapest grid.",
  },
];

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        That page isn&apos;t here
      </h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        The link may be out of date — scenario URLs change when the library is
        regenerated. Nothing is broken; you just need a different door.
      </p>

      <ul className="mt-8 border-t border-zinc-200 dark:border-zinc-800">
        {SUGGESTIONS.map((s) => (
          <li
            key={s.href}
            className="border-b border-zinc-200 dark:border-zinc-800"
          >
            <Link
              href={s.href}
              className="group flex items-baseline gap-3 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
            >
              <span className="font-display w-44 shrink-0 font-medium text-black dark:text-zinc-50">
                {s.label}
              </span>
              <span className="min-w-0 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                {s.body}
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
  );
}
