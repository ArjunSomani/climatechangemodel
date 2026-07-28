import Link from "next/link";
import latticeData from "@/data/playground_lattice.json";
import { PlaygroundClient } from "@/components/PlaygroundClient";
import { MoralChoiceNote, UncertaintyBandNote } from "@/components/SafetyDisclosure";
import { REGIONS } from "@/lib/regions";
import type { Lattice } from "@/lib/playground";

const lattice = latticeData as Lattice;

export const metadata = {
  title: "Carbon vs. mortality playground — Optimize",
  description:
    "Move two sliders — a carbon price and a mortality price — and watch the cheapest grid change in real time.",
};

export default function PlaygroundPage() {
  const regionName = REGIONS[lattice.region] ?? lattice.region;
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
        Two harms, two sliders
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance">
        Move the prices, watch the grid
      </h1>
      <p className="mt-5 text-lg text-zinc-600 dark:text-zinc-400">
        A carbon price and a mortality price pull the cheapest grid in different
        directions. Drag both and see it happen — instantly, off a grid of runs
        pre-computed for {regionName}. Coal exits under either price; the{" "}
        <strong>gas</strong> share is where they disagree.
      </p>

      <div className="mt-10 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800 sm:p-6">
        <PlaygroundClient lattice={lattice} />
      </div>

      <div className="mt-8 space-y-2">
        <UncertaintyBandNote />
        <MoralChoiceNote />
      </div>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        This is a coarse demo grid for one region. To run any region at full
        resolution with your own knobs, use a{" "}
        <Link href="/custom-run" className="underline hover:text-accent">
          custom run
        </Link>
        , or read how the two prices work on the{" "}
        <Link href="/safety" className="underline hover:text-accent">
          Safety &amp; mortality
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
