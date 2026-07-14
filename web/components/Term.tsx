"use client";

import { useId, useState } from "react";

/**
 * Inline glossary term. Works on touch (tap toggles) as well as hover/focus
 * (desktop) -- native `title=` tooltips never fire on touch devices, which
 * is why this exists instead of just using `title`.
 */
export function Term({
  children,
  definition,
}: {
  children: React.ReactNode;
  definition: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="cursor-help underline decoration-dotted underline-offset-2"
      >
        {children}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-normal text-zinc-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {definition}
        </span>
      )}
    </span>
  );
}
