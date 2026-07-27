// Server Component. Renders a persistent warning bar on every page of any
// NON-production deployment, and nothing at all in production.
//
// Gating is on VERCEL_ENV, read here at render time on the server (never
// shipped to the client, so no NEXT_PUBLIC_ prefix and no way to spoof it in
// the browser). Vercel sets VERCEL_ENV to "production" | "preview" |
// "development"; locally under `next dev` it is undefined. We show the banner
// whenever the value is anything OTHER than "production" -- so it appears on
// preview builds and local dev, and can never appear in production even if
// this branch is one day merged to the production branch.
export function PreviewBanner() {
  if (process.env.VERCEL_ENV === "production") return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-100"
    >
      <span className="font-semibold">Preview build.</span>{" "}
      Experimental mortality-pricing feature. Numbers here are not final and
      this deployment is not the published site.
    </div>
  );
}
