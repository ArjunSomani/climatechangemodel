"use client";

import { useEffect, useRef, useState } from "react";
import type { YearRecord } from "@/lib/library";
import type { RunStatus } from "@/lib/runs";
import type { ScenarioConfigInput } from "@/lib/scenarioConfig";

const POLL_INTERVAL_MS = 3000;

// A network failure used to re-poll every 3s forever, so a laptop that slept
// through a queue wait woke up having hammered a dead endpoint indefinitely with
// no way for the user to know anything was wrong. Back off, then give up and say
// so -- an unbounded retry loop is not resilience, it's a hidden failure.
const MAX_NETWORK_RETRIES = 8;
const BACKOFF_CAP_MS = 30_000;

export interface RunStatusState {
  status: RunStatus | "loading";
  errorMessage: string | null;
  config: ScenarioConfigInput | null;
  result: YearRecord[] | null;
}

// No polling precedent existed anywhere in this app before Custom Run --
// everything else is server-rendered synchronously against Neon/Blob.
export function useRunStatus(runId: string): RunStatusState {
  const [state, setState] = useState<RunStatusState>({
    status: "loading",
    errorMessage: null,
    config: null,
    result: null,
  });
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    stopped.current = false;
    let networkFailures = 0;

    // Held in a ref so unmount can cancel an already-scheduled poll. Guarding
    // only the *scheduling* path left a pending timer to fire after unmount and
    // issue one more fetch for a page nobody was on.
    function schedule(delay: number) {
      if (stopped.current) return;
      timer.current = setTimeout(poll, delay);
    }

    async function poll() {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({
            status: "error",
            errorMessage: body.error ?? "Run not found",
            config: null,
            result: null,
          });
          return;
        }
        const body = await res.json();
        networkFailures = 0;
        if (stopped.current) return;
        setState(body);
        if (body.status === "queued" || body.status === "running") {
          schedule(POLL_INTERVAL_MS);
        }
      } catch {
        networkFailures += 1;
        if (stopped.current) return;
        if (networkFailures > MAX_NETWORK_RETRIES) {
          setState({
            status: "error",
            errorMessage:
              "Lost contact with the server while waiting for this run. " +
              "The run itself may still be going — reload to check again.",
            config: null,
            result: null,
          });
          return;
        }
        // Exponential backoff, capped: 3s, 6s, 12s, 24s, then 30s.
        schedule(
          Math.min(POLL_INTERVAL_MS * 2 ** (networkFailures - 1), BACKOFF_CAP_MS)
        );
      }
    }

    poll();
    return () => {
      stopped.current = true;
      clearTimeout(timer.current);
    };
  }, [runId]);

  return state;
}
