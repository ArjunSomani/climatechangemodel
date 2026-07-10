import { useEffect } from "react";

// Recharts' ResponsiveContainer sometimes keeps a stale (too-narrow)
// initial measurement -- most visible when several charts mount in the
// same tick (e.g. Compare's trajectory chart + small-multiples), where
// the first chart's ResizeObserver callback can fire before layout has
// fully settled and never re-fires afterward. Dispatching one resize
// event shortly after mount nudges Recharts to re-measure and fixes it;
// confirmed empirically -- forcing a real window resize corrects the
// same charts that render short without it.
export function useForceResizeOnMount() {
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    return () => clearTimeout(t);
  }, []);
}
