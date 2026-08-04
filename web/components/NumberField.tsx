"use client";

import { useEffect, useId, useRef, useState } from "react";

// A numeric input that can be empty.
//
// The bug this exists to fix: every field on the custom-run form was
//
//   value={someNumber}
//   onChange={(e) => set(Number(e.target.value))}
//
// and `Number("") === 0`. So clearing a field to retype it silently rewrote it
// to 0 -- the user watched a `0` appear in a box they had just emptied. For the
// years field that at least failed validation. For the 30 per-source multipliers
// it did not: a capital-cost multiplier of 0 is a perfectly valid number, so
// submitting a form with one cleared field returned 200 and queued a real
// optimizer run in which that technology is free to build. Scientifically
// meaningless output, presented exactly like good output, with no warning
// anywhere. Verified end to end before fixing: cleared field -> API 200 -> run
// queued.
//
// The fix is to stop conflating "empty" with "zero". This keeps the raw text as
// its own state so an empty box stays empty, reports `null` upward for empty or
// unparseable, and lets the form refuse to submit while any field is in that
// state. Intermediate text that isn't yet a number ("-", "1e", ".") is preserved
// as typed rather than being coerced mid-keystroke, which is the other thing
// `Number(e.target.value)` got wrong.
export function NumberField({
  value,
  onChange,
  label,
  min,
  max,
  step = "any",
  className,
  invalidMessage = "Enter a number",
}: {
  // null means the form already knows this field is empty; in that case there is
  // nothing to sync down and the user's raw text is left alone.
  value: number | null;
  onChange: (next: number | null) => void;
  label: string;
  min?: number;
  max?: number;
  step?: string | number;
  className?: string;
  invalidMessage?: string;
}) {
  const [text, setText] = useState(() => (value === null ? "" : String(value)));
  const errorId = useId();
  // Tracks the last value we ourselves emitted, so a parent re-render with the
  // same number doesn't clobber what the user is mid-way through typing (e.g.
  // "1." would be rewritten to "1" on every keystroke).
  const lastEmitted = useRef<number | null>(value);

  useEffect(() => {
    if (value !== null && value !== lastEmitted.current) {
      setText(String(value));
      lastEmitted.current = value;
    }
  }, [value]);

  const parsed = text.trim() === "" ? null : Number(text);
  const isValid =
    parsed !== null &&
    Number.isFinite(parsed) &&
    (min === undefined || parsed >= min) &&
    (max === undefined || parsed <= max);

  function handle(next: string) {
    setText(next);
    const n = next.trim() === "" ? null : Number(next);
    const ok =
      n !== null &&
      Number.isFinite(n) &&
      (min === undefined || n >= min) &&
      (max === undefined || n <= max);
    lastEmitted.current = ok ? n : null;
    onChange(ok ? n : null);
  }

  return (
    <>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        aria-label={label}
        aria-invalid={isValid ? undefined : true}
        aria-describedby={isValid ? undefined : errorId}
        className={className}
        value={text}
        onChange={(e) => handle(e.target.value)}
      />
      {/* Always rendered so the description target exists before it has content;
          aria-describedby is only pointed at it while actually invalid. */}
      <span
        id={errorId}
        className={
          isValid
            ? "sr-only"
            : "mt-1 block text-xs font-medium text-red-700 dark:text-red-400"
        }
      >
        {isValid ? "" : invalidMessage}
      </span>
    </>
  );
}
