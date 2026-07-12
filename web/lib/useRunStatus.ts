"use client";

import { useEffect, useRef, useState } from "react";
import type { YearRecord } from "@/lib/library";
import type { RunStatus } from "@/lib/runs";

const POLL_INTERVAL_MS = 3000;

export interface RunStatusState {
  status: RunStatus | "loading";
  errorMessage: string | null;
  result: YearRecord[] | null;
}

// No polling precedent existed anywhere in this app before Custom Run --
// everything else is server-rendered synchronously against Neon/Blob.
export function useRunStatus(runId: string): RunStatusState {
  const [state, setState] = useState<RunStatusState>({
    status: "loading",
    errorMessage: null,
    result: null,
  });
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;

    async function poll() {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({
            status: "error",
            errorMessage: body.error ?? "Run not found",
            result: null,
          });
          return;
        }
        const body = await res.json();
        setState(body);
        if (!stopped.current && (body.status === "queued" || body.status === "running")) {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!stopped.current) setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      stopped.current = true;
    };
  }, [runId]);

  return state;
}
