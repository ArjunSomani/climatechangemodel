"use client";

import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// The source of truth for the active theme is <html data-theme>, set before
// paint by the inline script in layout.tsx (default dark). We read it via
// useSyncExternalStore -- the server snapshot is the "dark" default, the client
// snapshot reflects the real attribute, and React reconciles the two without a
// hydration warning. A tiny listener set lets our own toggle trigger re-renders.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme = getSnapshot() === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private-mode / storage-disabled: the toggle still works for this
      // session, it just won't be remembered.
    }
    listeners.forEach((l) => l());
  }, []);

  const isDark = theme === "dark";
  const label = `Switch to ${isDark ? "light" : "dark"} mode`;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="-m-2 flex h-11 w-11 items-center justify-center text-zinc-600 hover:text-black sm:h-9 sm:w-9 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      {isDark ? (
        // Sun -- click to switch to light
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="3.5" />
          <path
            strokeLinecap="round"
            d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4"
          />
        </svg>
      ) : (
        // Moon -- click to switch to dark
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 11.5A6.5 6.5 0 0 1 8.5 3.5a6.5 6.5 0 1 0 8 8Z"
          />
        </svg>
      )}
    </button>
  );
}
