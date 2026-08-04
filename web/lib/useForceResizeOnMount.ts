import { useEffect } from "react";

// Recharts' ResponsiveContainer sometimes keeps a stale (too-narrow) initial
// measurement -- most visible when several charts mount in the same tick (e.g.
// Compare's trajectory chart + small-multiples), where the first chart's
// ResizeObserver callback can fire before layout has fully settled and never
// re-fires afterward. Dispatching one resize event shortly after mount nudges
// Recharts to re-measure and fixes it; confirmed empirically -- forcing a real
// window resize corrects the same charts that render short without it.
//
// The event is global, so every mounted ResponsiveContainer re-measures on each
// dispatch. Ten chart components call this hook, and Compare mounts five or more
// at once -- one timer each meant N dispatches triggering N re-measures apiece,
// quadratic in the number of charts on the page for a fix that only ever needed
// to happen once. So the dispatch is coalesced module-wide: whichever charts
// mount in a given burst, exactly one resize event goes out after the last of
// them settles.
let pending: ReturnType<typeof setTimeout> | undefined;
let mounted = 0;

export function useForceResizeOnMount() {
  useEffect(() => {
    mounted += 1;
    // Re-arm rather than stack: a chart mounting 20ms after another pushes the
    // single dispatch out, it doesn't add a second one.
    clearTimeout(pending);
    pending = setTimeout(() => {
      pending = undefined;
      window.dispatchEvent(new Event("resize"));
    }, 100);

    return () => {
      mounted -= 1;
      // Last chart on the page going away: drop a dispatch nothing would use.
      if (mounted === 0) {
        clearTimeout(pending);
        pending = undefined;
      }
    };
  }, []);
}
