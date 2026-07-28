import { test, expect, type Page } from "playwright/test";

// Static, database-free pages. These render without Neon/Postgres or Blob
// storage env, so they are safe to smoke-test.
//
// `heading` is an exact known heading string where we know it. For pages added
// by other in-flight work (/about, /findings) we don't assert exact copy — we
// just require that some <h1> is visible.
const STATIC_PAGES: Array<{ path: string; heading?: string }> = [
  { path: "/how-it-works", heading: "How it works" },
  { path: "/safety", heading: "Electricity kills people — unevenly" },
  { path: "/playground", heading: "Move the prices, watch the grid" },
  { path: "/methodology", heading: "Methodology" },
  // Added by other work; assert a generic visible <h1> rather than exact copy.
  { path: "/about" },
  { path: "/findings" },
];

// DB-backed pages depend on Neon/Postgres + Vercel Blob env and will error
// without it, so they are intentionally NOT smoke-tested here:
//   /            (home — pulls from the library/runs data)
//   /library     (reads case data from the DB)
//   /compare     (reads runs from the DB)
//   /custom-run  (creates/reads runs in the DB + Blob)
// Re-enable these once a test DB/Blob fixture is available.
const DB_BACKED_PAGES = ["/", "/library", "/compare", "/custom-run"];

for (const path of DB_BACKED_PAGES) {
  test.skip(`DB-backed page ${path} (needs Neon/Blob env)`, () => {
    // Intentionally skipped: requires database + blob storage environment.
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
