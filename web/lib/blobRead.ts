import { get } from "@vercel/blob";

// Every scenario result body lives in Blob storage, so rendering /library,
// /library/[caseId], /compare, or /us means one HTTPS round-trip per case on the
// server's critical path. Those round-trips are the least reliable part of the
// render, and an audit run caught both failure modes for real:
//
//   TypeError: fetch failed
//     [cause] ConnectTimeoutError (private.blob.vercel-storage.com:443, 10000ms)
//   Error: Client network socket disconnected before secure TLS connection
//         was established (ECONNRESET)
//
// Both are transient and both threw straight through the call sites, taking the
// whole page to a 500 -- /compare failed while /library rendered fine seconds
// later with overlapping data. A connect timeout or a TLS reset on the first
// attempt says nothing about the second, so one cheap retry converts most of
// these into a normal render. Beyond that the error propagates to app/error.tsx,
// which offers a real retry rather than a stack trace.
//
// Deliberately not retried: a 404 or any other HTTP status. Those are answers,
// not failures, and re-asking won't change them.
const RETRY_DELAY_MS = 250;

export async function readBlobText(url: string): Promise<string | null> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
    try {
      const res = await get(url, { access: "private" });
      // A real HTTP answer: return it (or null) without retrying.
      if (!res || res.statusCode !== 200) return null;
      return await new Response(res.stream).text();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

// Same retry, but a transport failure degrades to null instead of throwing. For
// callers that already have a graceful "result unavailable" branch and would
// rather show it than surface an error page.
export async function tryReadBlobText(url: string): Promise<string | null> {
  try {
    return await readBlobText(url);
  } catch {
    return null;
  }
}
