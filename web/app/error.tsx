"use client";

import Link from "next/link";
import { useEffect } from "react";

// There was no error boundary anywhere in the app. Every data-backed route
// (/library, /library/[caseId], /compare, /us, /data-explorer) reads Postgres and
// then fetches a result body from Blob storage, and neither read was wrapped --
// so a transient storage hiccup produced a bare 500 with no navigation and no
// explanation. This is not hypothetical: an audit run hit
//
//   TypeError: fetch failed
//     [cause] ConnectTimeoutError: ... private.blob.vercel-storage.com:443
//   Error: Client network socket disconnected before secure TLS connection
//
// and /compare returned 500 while /library rendered fine seconds later. A blob
// round-trip over a flaky network is exactly the failure this boundary is for:
// the right response is "try again", not a stack trace.
//
// reset() re-runs the failed server render, which is the correct retry for a
// transient I/O error -- no reload, no lost scroll position.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-thrown errors reach the client with the message stripped and only a
    // digest, so log what we do have -- the digest is what correlates this to the
    // full stack in the platform logs.
    console.error("route error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Something went wrong
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        This page couldn&apos;t load its data
      </h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Scenario results live in blob storage and are fetched when the page
        renders. That request failed — usually a momentary network or storage
        problem rather than anything wrong with the scenario itself. Trying again
        normally works.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground"
        >
          Try again
        </button>
        <Link
          href="/library"
          className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:border-accent dark:border-zinc-700"
        >
          Back to the library
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-xs text-zinc-500 dark:text-zinc-400">
          Reference:{" "}
          <span className="tabular-nums">{error.digest}</span>
        </p>
      )}
    </div>
  );
}
