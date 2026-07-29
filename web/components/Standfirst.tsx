import type { ReactNode } from "react";

// Five pages opened with the same 12px uppercase letter-spaced accent-colored
// line above the h1. That treatment is the single most saturated tell in
// generated web design right now -- it appears regardless of brief, which is
// what makes it grammar rather than voice. Three of the five were also
// redundant ("What we found" above a Findings h1; "All 13 regions combined"
// directly above "Summed across 13 regions") and were simply deleted.
//
// The two that carried real information kept it, in a treatment that belongs to
// *this* site instead of to the template: the same Fraunces the headings use,
// italic, sentence case, no tracking. It reads as a magazine standfirst under a
// serif headline -- which is what the type system here already is -- and it
// stays at two deliberate uses site-wide, not one per page.
export function Standfirst({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-base text-zinc-600 italic dark:text-zinc-400">
      {children}
    </p>
  );
}
