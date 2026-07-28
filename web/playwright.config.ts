// Playwright config for smoke tests.
//
// Note: this repo has the `playwright` package (which bundles the test runner)
// but not a separate `@playwright/test` package, so we import from
// `playwright/test`. The CLI (`playwright test`) works the same way.
//
// The environment ships a pre-installed Chromium at a fixed path and has NO
// downloaded Playwright browser bundle, so we point launchOptions.executablePath
// at that binary and never run `playwright install`.
import { defineConfig, devices } from "playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const CHROMIUM_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

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
    launchOptions: {
      executablePath: CHROMIUM_PATH,
    },
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
      PLAYWRIGHT_BROWSERS_PATH: "/opt/pw-browsers",
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
    },
  },
});
