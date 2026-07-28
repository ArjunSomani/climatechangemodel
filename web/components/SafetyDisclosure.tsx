import Link from "next/link";

// Reusable safety/mortality disclosures, so the framing is identical on every
// page rather than re-worded each time. Plain server components.

export function SafetyCallout({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "grave";
}) {
  const border =
    tone === "grave"
      ? "border-[var(--mortality)]/40"
      : "border-zinc-200 dark:border-zinc-800";
  return (
    <div
      className={`rounded-lg border ${border} bg-zinc-50/60 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400`}
    >
      {children}
    </div>
  );
}

// The one non-negotiable framing: pricing a death is the user's moral choice,
// not something the model resolves. Shown anywhere a mortality price appears.
export function MoralChoiceNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-zinc-500 dark:text-zinc-400 ${className}`}>
      Assigning a dollar value to a death is a moral choice you are making, not
      a technical parameter the model resolves. The VSL figures are HHS&apos;s
      published range, shown as published values — never as endorsement.
    </p>
  );
}

// The accounting caveat, stated wherever regional or per-source deaths appear.
export function AttributionNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-zinc-500 dark:text-zinc-400 ${className}`}>
      Deaths are an accounting attribution to the generating region, not an
      atmospheric model — real pollution crosses regional boundaries, harming
      people on both sides of a border. The uncertainty band propagates into any
      priced-mortality cost, so a priced total is a band, not a single number.
    </p>
  );
}

// Counted vs modeled, the distinction that must survive from Level everywhere.
export function CountedModeledNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-zinc-500 dark:text-zinc-400 ${className}`}>
      <span className="font-medium text-zinc-600 dark:text-zinc-300">
        Counted
      </span>{" "}
      deaths are recorded accidents;{" "}
      <span className="font-medium text-zinc-600 dark:text-zinc-300">
        modeled
      </span>{" "}
      deaths are air-pollution and radiation attributions from epidemiological
      models. They are shown distinctly (solid vs hatched) throughout.
    </p>
  );
}

export function LevelCreditNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-zinc-500 dark:text-zinc-400 ${className}`}>
      Coefficients are imported from{" "}
      <a
        href="https://levelmodel.vercel.app"
        className="underline hover:text-accent"
        target="_blank"
        rel="noreferrer"
      >
        Level
      </a>
      , the descriptive source of truth for these figures — not re-derived here.
      See the{" "}
      <Link href="/safety" className="underline hover:text-accent">
        Safety &amp; mortality
      </Link>{" "}
      page for how they enter the model.
    </p>
  );
}
