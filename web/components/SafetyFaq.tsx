// Anticipate the reactions a "dollar value on lives" page provokes and answer
// them plainly. Native <details> so it works with no JS and stays accessible.

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Isn't putting a dollar value on a life wrong?",
    a: (
      <>
        You already do it — every time society declines to spend infinitely on
        safety, it has implicitly priced a life. A speed limit, a hospital
        budget, a workplace-safety rule all embed a number. This tool just makes
        the number <em>explicit</em> and lets you choose it. That choice is
        yours and it is moral, not technical — the model doesn&apos;t resolve it
        for you.
      </>
    ),
  },
  {
    q: "Why is coal's rate so uncertain — 24.6, up to 224?",
    a: (
      <>
        Almost all of coal&apos;s toll is <em>modeled</em> air-pollution death,
        not counted accidents, and modeling it means choosing exposure and
        concentration-response assumptions. The central figure uses mainstream
        assumptions; the high bound uses more pessimistic ones. The width of
        that band is honest uncertainty, not sloppiness.
      </>
    ),
  },
  {
    q: "Why doesn't gas exit under a mortality price, the way it does under carbon?",
    a: (
      <>
        Gas is about 9× cleaner than coal on deaths but only about 1.7× cleaner
        on CO₂. So a mortality price crushes coal while leaving gas relatively
        cheap — the optimizer keeps gas and lets it fill in. A carbon price
        treats coal and gas more alike, so it pushes past gas toward renewables.
        That disagreement about gas is the whole point of pricing both.
      </>
    ),
  },
  {
    q: "Where are Chernobyl and Fukushima in nuclear's 0.03?",
    a: (
      <>
        Included. Even counting every death from every nuclear accident,
        nuclear comes out around 0.03 deaths/TWh — roughly 800× safer than coal.
        The toll from electricity is dominated by coal&apos;s ordinary,
        everyday air pollution, not by rare disasters. The number isn&apos;t
        hiding the accidents; the accidents are just small next to the smog.
      </>
    ),
  },
  {
    q: "Are these US numbers?",
    a: (
      <>
        No — they&apos;re global averages. US coal with modern scrubbers is
        probably somewhat safer than the global fleet, so treat these as
        order-of-magnitude figures, not precise US values. Getting the{" "}
        <em>ranking</em> right (coal ≫ gas ≫ nuclear ≈ renewables) matters more
        here than any single decimal.
      </>
    ),
  },
  {
    q: "Why only deaths — what about illness?",
    a: (
      <>
        Morbidity — asthma, hospitalizations, lost workdays — is real and far
        larger in count than death. It&apos;s also harder to value consistently,
        so it&apos;s deliberately out of scope for this first cut. Excluding it
        means these figures <em>understate</em> the full health burden.
      </>
    ),
  },
  {
    q: "Why does battery have no death rate?",
    a: (
      <>
        A battery generates nothing of its own; it time-shifts electricity some
        other source already made, and that source&apos;s deaths were counted
        when it generated. Giving the battery its own rate would double-count.
      </>
    ),
  },
];

export function SafetyFaq() {
  return (
    <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {FAQ.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:content-none">
            {item.q}
            <span
              aria-hidden
              className="shrink-0 text-zinc-500 dark:text-zinc-400 transition group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="px-4 pb-4 text-sm text-zinc-600 dark:text-zinc-400">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}
