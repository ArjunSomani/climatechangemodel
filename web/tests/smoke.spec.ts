import { test, expect, type Page } from "playwright/test";

// Static, database-free pages. These render without Neon/Postgres or Blob
// storage env, so they are safe to smoke-test.
//
// `heading` is an exact known heading string where we know it. For pages added
// by other in-flight work (/about) we don't assert exact copy — we just require
// that some <h1> is visible.
const STATIC_PAGES: Array<{ path: string; heading?: string }> = [
  { path: "/", heading: "The cheapest way to decarbonize" },
  { path: "/how-it-works", heading: "How it works" },
  { path: "/safety", heading: "Electricity kills people — unevenly" },
  { path: "/playground", heading: "Move the prices, watch the grid" },
  { path: "/methodology", heading: "Methodology" },
  { path: "/custom-run", heading: "Custom run" },
  // Added by other work; assert a generic visible <h1> rather than exact copy.
  { path: "/about" },
];

// DB-backed pages depend on Neon/Postgres + Vercel Blob env and error without
// it, so they can't run in the secret-less CI job. They are NOT permanently
// disabled, though: the bodies below are real, and they self-activate whenever
// a seeded database + blob store is wired up. Opt in by setting SMOKE_DB_PAGES=1
// (locally against a dev/staging DB, or in a future CI job that has the
// DATABASE_URL + BLOB_READ_WRITE_TOKEN secrets); otherwise each one skips with a
// visible reason rather than silently not existing.
//
//   /library        (reads case summaries from the DB)
//   /compare        (reads runs from the DB + their blobs)
//   /us             (aggregates the 13 regions from the DB + their blobs)
//   /data-explorer  (reads the EIA snapshot from blob storage)
//
// `/` and `/custom-run` used to be on this list. They are not DB-backed any
// more -- the landing page dropped its live library teaser and both now
// prerender as static (confirmed by `next build` marking them ○) -- so they
// moved up into STATIC_PAGES.
const DB_BACKED_PAGES = ["/library", "/compare", "/us", "/data-explorer"];
const DB_PAGES_ENABLED = process.env.SMOKE_DB_PAGES === "1";

for (const path of DB_BACKED_PAGES) {
  test(`DB-backed page ${path} loads without errors`, async ({ page }) => {
    test.skip(
      !DB_PAGES_ENABLED,
      "set SMOKE_DB_PAGES=1 with a seeded DATABASE_URL + BLOB_READ_WRITE_TOKEN to run",
    );

    const errors = collectConsoleErrors(page);

    const response = await page.goto(path, { waitUntil: "load" });
    expect(response, `no response for ${path}`).not.toBeNull();
    expect(response!.status(), `unexpected status for ${path}`).toBe(200);

    // Copy varies across these pages; require a visible top-level heading rather
    // than coupling the smoke test to exact wording.
    await expect(page.locator("h1").first()).toBeVisible();

    expect(
      errors,
      `console/page errors on ${path}:\n${errors.join("\n")}`,
    ).toEqual([]);
  });
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

test("landing page leads with one primary action", async ({ page }) => {
  // The four entry points were a 2x2 of identical cards; they are now one
  // primary CTA plus a secondary list. Guard that the CTA is actually there and
  // points where it should, so a future edit can't quietly flatten it back.
  await page.goto("/", { waitUntil: "load" });
  const cta = page.getByRole("link", { name: /Run your own scenario/i });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/custom-run");
});

for (const { path, heading } of STATIC_PAGES) {
  test(`static page ${path} loads without errors`, async ({ page }) => {
    const errors = collectConsoleErrors(page);

    const response = await page.goto(path, { waitUntil: "load" });
    expect(response, `no response for ${path}`).not.toBeNull();
    expect(response!.status(), `unexpected status for ${path}`).toBe(200);

    if (heading) {
      await expect(
        page.getByRole("heading", { name: heading, exact: false }),
      ).toBeVisible();
    } else {
      // Unknown-copy page: just require a visible top-level heading.
      await expect(page.locator("h1").first()).toBeVisible();
    }

    expect(errors, `console/page errors on ${path}:\n${errors.join("\n")}`).toEqual([]);
  });
}
