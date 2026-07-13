"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: [string, string][] = [
  ["/how-it-works", "How it works"],
  ["/library", "Library"],
  ["/compare", "Compare"],
  ["/custom-run", "Custom Run"],
  ["/data-explorer", "Data Explorer"],
  ["/methodology", "Methodology"],
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight"
          onClick={() => setOpen(false)}
        >
          Optimize
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 sm:flex">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={
                isActive(pathname, href)
                  ? "text-sm font-medium text-accent"
                  : "text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
              }
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center sm:hidden"
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

      {/* Mobile menu panel */}
      {open && (
        <nav className="border-t border-zinc-200 px-6 py-3 sm:hidden dark:border-zinc-800">
          <ul className="flex flex-col gap-1">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className={
                    isActive(pathname, href)
                      ? "block rounded px-2 py-2 text-sm font-medium text-accent"
                      : "block rounded px-2 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  }
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
