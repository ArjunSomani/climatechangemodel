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
  ["/findings", "Findings"],
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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight"
          onClick={() => setOpen(false)}
        >
          Optimize
        </Link>

        <div className="flex items-center gap-2 lg:gap-5">
          {/* Desktop nav -- 8 links need real width, so it only appears at lg+
              (1024px). Below that the row would overflow, so we show the
              hamburger instead (tablets included). */}
          <nav aria-label="Main" className="hidden items-center gap-5 lg:flex">
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
            className="-mr-2.5 flex h-11 w-11 items-center justify-center lg:hidden"
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
          (open ? "block lg:hidden" : "hidden")
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
