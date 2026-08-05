"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS: [string, string][] = [
  ["/how-it-works", "How it works"],
  ["/library", "Library"],
  ["/compare", "Compare"],
  ["/custom-run", "Custom Run"],
  ["/safety", "Safety"],
  ["/playground", "Playground"],
  ["/data-explorer", "Data Explorer"],
  ["/methodology", "Methodology"],
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu on Escape so keyboard users aren't stuck in it.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      {/* flex-wrap is the structural guarantee. The navwide breakpoint decides
          when the desktop row *should* appear, but a breakpoint is always a guess
          about whether nine links fit, and em in a media query resolves against
          the initial font size rather than :root -- so it tracks the browser's
          font-size setting but not every text-scaling route. Wrapping means that
          when the guess is wrong the nav drops to a second line instead of
          overflowing the page, which is the failure mode that actually matters. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight"
          onClick={() => setOpen(false)}
        >
          Optimize
        </Link>

        <div className="flex min-w-0 items-center gap-2 navwide:gap-5">
          {/* Desktop nav -- nine links need real width, so it only appears at
              `navwide` (64em, defined in globals.css). Below that the row would
              overflow, so we show the hamburger instead (tablets included).
              The breakpoint is in em rather than px on purpose: it has to track
              the user's text size, not just the viewport, or scaling text to
              200% keeps the desktop row and overflows the header. */}
          <nav
            aria-label="Main"
            className="hidden flex-wrap items-center gap-x-5 gap-y-1 navwide:flex"
          >
            {LINKS.map(([href, label]) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  // aria-current is the only non-visual carrier of "you are
                  // here" -- the accent color alone fails SC 1.4.1.
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "text-sm font-medium text-accent underline decoration-2 underline-offset-4"
                      : "text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
                  }
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <ThemeToggle />

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
            className="-mr-2.5 flex h-11 w-11 items-center justify-center navwide:hidden"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-black dark:text-zinc-50"
            >
              {open ? (
                <path strokeLinecap="round" d="M4 4l12 12M16 4L4 16" />
              ) : (
                <path strokeLinecap="round" d="M3 5h14M3 10h14M3 15h14" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu panel. Always in the DOM, display:none when closed, so the
          hamburger's aria-controls always resolves to a real element -- a
          dangling idref is announced as a broken relationship. display:none
          also keeps it out of the a11y tree and the tab order while closed,
          which a plain `hidden` attribute can't guarantee against author-layer
          CSS. */}
      <nav
        id="mobile-nav"
        aria-label="Main"
        className={
          "border-t border-zinc-200 px-6 py-3 dark:border-zinc-800 " +
          (open ? "block navwide:hidden" : "hidden")
        }
      >
        <ul className="flex flex-col gap-1">
          {LINKS.map(([href, label]) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "flex min-h-11 items-center rounded px-2 py-2 text-base font-medium text-accent"
                      : "flex min-h-11 items-center rounded px-2 py-2 text-base text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  }
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
