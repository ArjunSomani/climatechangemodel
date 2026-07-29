// Playwright config for smoke tests.
//
// Note: this repo has the `playwright` package (which bundles the test runner)
// but not a separate `@playwright/test` package, so we import from
// `playwright/test`. The CLI (`playwright test`) works the same way.
//
// Browser resolution is environment-dependent, so it is configurable rather
// than hard-coded. The CI image ships a pre-installed Chromium at a fixed path
// and has no downloaded Playwright bundle; a developer machine has the normal
// `playwright install` cache and needs no override at all. Baking the CI path in
// meant the suite could only ever run on that one image -- on macOS it failed
// before launching, pointing at a directory that does not exist.
//
// Set PLAYWRIGHT_CHROMIUM_PATH to force a specific binary; leave it unset to let
// Playwright find its own.
import { defineConfig, devices } from "playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "off",
    // Only override the executable when a path was actually supplied --
    // `executablePath: undefined` is fine, an empty string is not.
    ...(CHROMIUM_PATH ? { launchOptions: { executablePath: CHROMIUM_PATH } } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Some pages require a production build, so run the built app via `npm start`.
  // Reuse an already-running server if present; otherwise allow generous time
  // for `next start` to come up.
  webServer: {
    command: `PORT=${PORT} npm start`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      ...(process.env.PLAYWRIGHT_BROWSERS_PATH
        ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH }
        : {}),
    },
  },
});
