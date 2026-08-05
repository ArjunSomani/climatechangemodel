import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect, type Page } from "playwright/test";

// Regression guards for the accessibility and responsive defects found by an
// audit pass. Each assertion here corresponds to something that was actually
// broken and measured, not to a hypothetical -- so a failure means a real
// regression, not a style opinion.
//
// Deliberately DB-free routes only, so this can run in CI without Neon/Blob.
const ROUTES = [
  "/",
  "/how-it-works",
  "/safety",
  "/playground",
  "/methodology",
  "/about",
  "/custom-run",
];

const THEMES = ["dark", "light"] as const;

async function withTheme(page: Page, theme: string) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* storage disabled: the page falls back to its default theme */
    }
  }, theme);
}

// Wait for a definite readiness signal instead of a fixed sleep.
//
// These assertions measure computed styles and laid-out geometry, both of which
// are only stable once the stylesheet has applied and webfonts have settled. A
// flat `waitForTimeout(300)` encodes a guess about machine speed, and it lost
// that bet once under load (a contrast assertion failed on a run where the whole
// suite took 4x its usual wall-clock, then passed 6/6 on rerun). A test that
// depends on how busy the machine is cannot distinguish a real regression from a
// slow moment, which makes its failures worthless -- so wait on the conditions
// that actually matter.
async function settle(page: Page, theme?: string) {
  await page.waitForFunction(
    (expected) => {
      // Stylesheet applied: the theme tokens resolve to real values.
      const root = getComputedStyle(document.documentElement);
      if (!root.getPropertyValue("--background").trim()) return false;
      if (!root.getPropertyValue("--accent").trim()) return false;
      // Requested theme is the one actually in effect.
      if (expected && document.documentElement.dataset.theme !== expected) {
        return false;
      }
      // Body has taken its themed background rather than the UA default.
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      if (!bodyBg || bodyBg === "rgba(0, 0, 0, 0)") return false;
      return document.fonts.status === "loaded";
    },
    theme,
    { timeout: 15_000 }
  );
}

// --- Contrast -------------------------------------------------------------
//
// Resolves each element's computed color through a canvas rather than parsing
// the string. Tailwind v4 emits oklch, which Chromium serializes as lab(); a
// regex-based parser silently skips every one of those, which is how a whole
// theme's worth of failures stayed invisible.
const CONTRAST_PROBE = () => {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true })!;
  const memo = new Map<string, { r: number; g: number; b: number; a: number } | null>();
  const parse = (s: string) => {
    if (!s) return null;
    if (memo.has(s)) return memo.get(s)!;
    let out: { r: number; g: number; b: number; a: number } | null = null;
    try {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = "#000";
      cx.fillStyle = s;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      out = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    } catch {
      out = null;
    }
    memo.set(s, out);
    return out;
  };
  type RGBA = { r: number; g: number; b: number; a: number };
  const lum = (c: RGBA) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (fg: RGBA, bg: RGBA): RGBA => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const ratio = (a: RGBA, b: RGBA) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  function effectiveBg(el: Element): RGBA {
    let n: Element | null = el;
    let acc: RGBA | null = null;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (acc.a >= 0.999) return acc;
      }
      n = n.parentElement;
    }
    return acc && acc.a >= 0.999 ? acc : { r: 255, g: 255, b: 255, a: 1 };
  }

  const failures: string[] = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const hasText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0
    );
    if (!hasText) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0)
      continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    const cr = ratio(over(fg, bg), bg);
    const px = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const large = px >= 24 || (px >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (cr < need - 0.005) {
      const cls = typeof el.className === "string" ? el.className.slice(0, 70) : "";
      failures.push(
        `${cr.toFixed(2)}:1 (needs ${need}) ${px}px/${weight} ` +
          `"${(el.textContent ?? "").trim().slice(0, 40)}" [${cls}]`
      );
    }
  }
  return failures;
};

for (const theme of THEMES) {
  for (const route of ROUTES) {
    test(`${theme} theme: text on ${route} meets WCAG AA contrast`, async ({ page }) => {
      await withTheme(page, theme);
      await page.goto(route, { waitUntil: "load" });
      await settle(page, theme);
      const failures = await page.evaluate(CONTRAST_PROBE);
      expect(
        failures,
        `${failures.length} contrast failure(s) on ${route} (${theme}):\n  ` +
          failures.join("\n  ")
      ).toEqual([]);
    });
  }
}

// --- Horizontal overflow --------------------------------------------------
//
// The metric switcher measured 419px as a non-wrapping inline-flex row, which
// pushed the whole document to scroll sideways on a 360px phone.
for (const route of ROUTES) {
  test(`no horizontal page scroll on ${route} at 360px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(route, { waitUntil: "load" });
    await settle(page);
    const { scrollW, docW, offenders } = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const offenders: string[] = [];
      if (document.documentElement.scrollWidth > docW + 1) {
        for (const el of Array.from(document.querySelectorAll("body *"))) {
          const r = el.getBoundingClientRect();
          const p = el.parentElement?.getBoundingClientRect();
          if (r.right > docW + 1 && r.width > 0 && (!p || p.right <= docW + 1)) {
            const cls = typeof el.className === "string" ? el.className.slice(0, 80) : "";
            offenders.push(`<${el.tagName.toLowerCase()}> right=${Math.round(r.right)} [${cls}]`);
          }
        }
      }
      return { scrollW: document.documentElement.scrollWidth, docW, offenders };
    });
    expect(
      scrollW,
      `${route} scrolls ${scrollW - docW}px sideways at 360px:\n  ` + offenders.join("\n  ")
    ).toBeLessThanOrEqual(docW + 1);
  });
}

// --- ARIA correctness -----------------------------------------------------

test("no role=tab without a matching tabpanel and roving tabindex", async ({ page }) => {
  // ResultCharts used to declare role="tablist" with five role="tab" buttons,
  // zero tabpanels, no aria-controls, and every tab at tabindex 0 -- so arrow
  // keys did nothing while the announcement promised they would. Claiming the
  // role means owing the whole keyboard contract; this asserts we either honor
  // it or don't claim it.
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: "load" });
    const broken = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      if (tabs.length === 0) return null;
      const panels = document.querySelectorAll('[role="tabpanel"]').length;
      const allControl = tabs.every((t) => t.hasAttribute("aria-controls"));
      const roving = tabs.filter((t) => (t as HTMLElement).tabIndex === 0).length === 1;
      if (panels > 0 && allControl && roving) return null;
      return { tabs: tabs.length, panels, allControl, roving };
    });
    expect(broken, `incomplete ARIA tab pattern on ${route}`).toBeNull();
  }
});

test("every page has a skip link that targets a real element", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  const target = await page.evaluate(() => {
    const skip = document.querySelector<HTMLAnchorElement>("a.skip-link");
    if (!skip) return { found: false, resolves: false };
    const id = skip.getAttribute("href")?.slice(1) ?? "";
    return { found: true, resolves: !!id && !!document.getElementById(id) };
  });
  expect(target.found, "no .skip-link in the layout").toBe(true);
  expect(target.resolves, "skip link href does not resolve to an element").toBe(true);
});

test("aria-controls references resolve", async ({ page }) => {
  // The nav hamburger pointed aria-controls at #mobile-nav, which only existed
  // while the menu was open -- a dangling idref for the entire closed state.
  await page.setViewportSize({ width: 360, height: 780 });
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: "load" });
    const dangling = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[aria-controls]"))
        .flatMap((el) => (el.getAttribute("aria-controls") ?? "").split(/\s+/))
        .filter((id) => id && !document.getElementById(id))
    );
    expect(dangling, `dangling aria-controls on ${route}`).toEqual([]);
  }
});

test("form fields have distinct accessible names", async ({ page }) => {
  // /custom-run rendered 33 inputs named "Initial" and 33 named "Yearly" --
  // every knob on the page indistinguishable to a screen reader.
  await page.goto("/custom-run", { waitUntil: "load" });
  // Open the advanced panel so the per-source fields are in the DOM.
  const details = page.locator("details").first();
  if (await details.count()) await details.evaluate((d: HTMLDetailsElement) => (d.open = true));

  const dupes = await page.evaluate(() => {
    const counts: Record<string, number> = {};
    for (const el of Array.from(document.querySelectorAll("input, select, textarea"))) {
      const i = el as HTMLInputElement;
      if (i.type === "hidden") continue;
      const label =
        i.getAttribute("aria-label") ??
        (i.id ? document.querySelector(`label[for="${i.id}"]`)?.textContent : null) ??
        i.closest("label")?.textContent ??
        "";
      const name = label.trim();
      if (!name) continue;
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return Object.entries(counts).filter(([, n]) => n > 1);
  });
  expect(
    dupes,
    "form controls sharing an accessible name: " + JSON.stringify(dupes)
  ).toEqual([]);
});

test("no input is left without an accessible name", async ({ page }) => {
  await page.goto("/custom-run", { waitUntil: "load" });
  const details = page.locator("details").first();
  if (await details.count()) await details.evaluate((d: HTMLDetailsElement) => (d.open = true));
  const unnamed = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input, select, textarea"))
      .filter((el) => {
        const i = el as HTMLInputElement;
        if (i.type === "hidden") return false;
        if (i.getAttribute("aria-label") || i.getAttribute("aria-labelledby")) return false;
        if (i.id && document.querySelector(`label[for="${i.id}"]`)) return false;
        if (i.closest("label")) return false;
        return true;
      })
      .map((el) => `<${el.tagName.toLowerCase()} type=${(el as HTMLInputElement).type}>`)
  );
  expect(unnamed, "inputs with no accessible name").toEqual([]);
});

// --- Error / edge routes -------------------------------------------------
//
// These were never rendered by earlier audits, which is exactly why they carried
// defects: a 404 that fought the theme, an unvalidated uuid path segment, and no
// error boundary anywhere in the app.

test("the 404 page keeps the app theme", async ({ page }) => {
  // Next's built-in not-found injects an UNLAYERED
  // `body{color:#000;background:#fff}` plus a prefers-color-scheme override.
  // Unlayered CSS beats @layer base, and this app's theme is attribute-driven,
  // so the built-in produced a white page wearing dark-theme chrome (nav links
  // measured 2.62:1). Defining app/not-found.tsx keeps the built-in from ever
  // rendering; this asserts the reset is gone.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("theme", "dark");
    } catch {
      /* storage disabled */
    }
  });
  const res = await page.goto("/definitely-not-a-real-page", { waitUntil: "load" });
  expect(res?.status()).toBe(404);

  const state = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    expected: getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim(),
  }));
  expect(state.theme).toBe("dark");
  // The dark --background is #100e0b -> rgb(16, 14, 11). A white body here means
  // Next's default fallback rendered and its unlayered reset won.
  expect(state.bodyBg).toBe("rgb(16, 14, 11)");
  expect(state.expected).toBe("#100e0b");

  // And it should be a way out, not a dead end.
  expect(await page.locator("main a[href]").count()).toBeGreaterThan(0);
});

test("the 404 page passes contrast in both themes", async ({ page }) => {
  for (const theme of THEMES) {
    await withTheme(page, theme);
    await page.goto("/definitely-not-a-real-page", { waitUntil: "load" });
    await settle(page, theme);
    const failures = await page.evaluate(CONTRAST_PROBE);
    expect(
      failures,
      `404 contrast failures (${theme}):\n  ` + failures.join("\n  ")
    ).toEqual([]);
  }
});

test("a malformed run id 404s instead of erroring", async ({ page }) => {
  // runs.id is a uuid column, so Postgres threw `invalid input syntax for type
  // uuid` on any hand-typed id -- a 500 plus a database error per poll, where the
  // honest answer is "no such run". getRunStatus rejects the bad format BEFORE
  // querying (UUID_RE guard), so this needs no database and runs in the DB-free
  // CI job.
  const res = await page.request.get("/api/runs/not-a-uuid");
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toBeTruthy();
});

test("an absent but well-formed run id is 404, not 500", async ({ page }) => {
  // A well-formed uuid passes the format guard and reaches the DB query, so this
  // one needs a live database -- gate it like the DB-backed smoke pages so it
  // self-activates with SMOKE_DB_PAGES=1 and skips (rather than 500s on an
  // unreachable pool) in the DB-free CI job.
  test.skip(
    process.env.SMOKE_DB_PAGES !== "1",
    "set SMOKE_DB_PAGES=1 with a seeded DATABASE_URL to run",
  );
  const absent = await page.request.get(
    "/api/runs/00000000-0000-4000-8000-000000000000"
  );
  expect(absent.status()).toBe(404);
});

test("the status page reports a bad run id rather than spinning", async ({ page }) => {
  await page.goto("/custom-run/not-a-uuid", { waitUntil: "load" });
  await expect(page.getByText(/Run failed|not found/i).first()).toBeVisible({
    timeout: 10_000,
  });
});

test("error boundaries are present for data-backed routes", async () => {
  // Blob reads sit on the server render path and do fail transiently
  // (ConnectTimeoutError and ECONNRESET were both observed during an audit run),
  // and without a boundary that is a bare 500 with no navigation.
  //
  // This is a source-presence check, not a behavioural one, and deliberately so:
  // inducing the failure needs storage to actually break, and a test that pokes a
  // healthy endpoint and asserts "ok" would pass forever while proving nothing.
  // The regression worth catching is someone deleting these files, which this
  // does catch.
  const boundaries = ["app/error.tsx", "app/global-error.tsx", "app/not-found.tsx"];
  for (const rel of boundaries) {
    const src = await readFile(resolve(rel), "utf8");
    expect(src, `${rel} has no default export`).toMatch(/export default function/);
  }

  // error.tsx must be a client component (it takes an onClick reset) and must
  // actually offer the retry -- a boundary with no way forward is a dead end.
  const err = await readFile(resolve("app/error.tsx"), "utf8");
  expect(err).toMatch(/^"use client"/);
  expect(err).toMatch(/reset\(\)|onClick=\{reset\}/);
});

test("the skip link's own focus ring is visible", async ({ page }) => {
  // The shared ring is `2px solid var(--accent)` and the skip link's background
  // IS --accent, so the one control that exists purely for keyboard users had a
  // 1:1 focus indicator.
  for (const theme of THEMES) {
    await withTheme(page, theme);
    await page.goto("/", { waitUntil: "load" });
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>("a.skip-link");
      if (!el) return null;
      el.focus();
      const cs = getComputedStyle(el);
      return {
        outlineColor: cs.outlineColor,
        background: cs.backgroundColor,
        boxShadow: cs.boxShadow,
      };
    });
    expect(ring, "no skip link").not.toBeNull();
    // The ring must not be the same colour as the thing it outlines.
    expect(
      ring!.outlineColor,
      `skip-link ring matches its own background in ${theme}`
    ).not.toBe(ring!.background);
    expect(ring!.boxShadow).not.toBe("none");
  }
});

// --- Focus indicators ----------------------------------------------------

test("every keyboard stop on the biggest form has a visible focus ring", async ({
  page,
}) => {
  // /custom-run is the densest surface in the app (~129 focus stops once the
  // advanced panel is open), so it's the right place to assert the ring survives
  // every control type: number inputs, selects, range, checkbox, summary,
  // buttons, links, submit.
  //
  // Driven by real Tab presses, not el.focus(). Chromium's :focus-visible
  // heuristic does not reliably fire for programmatic focus, which produced a
  // confident false positive ("5 inputs have no ring") when an earlier probe
  // used .focus() — the ring was there the whole time. Keyboard traversal is the
  // only ground truth for a keyboard affordance.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/custom-run", { waitUntil: "load" });
  const details = page.locator("details").first();
  if (await details.count()) {
    await details.evaluate((d: HTMLDetailsElement) => (d.open = true));
  }

  const unindicated: string[] = [];
  let stops = 0;

  for (let i = 0; i < 140; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const hasOutline =
        cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const hasShadow = cs.boxShadow !== "none" && cs.boxShadow !== "";
      return {
        id: `${el.tagName.toLowerCase()}${(el as HTMLInputElement).type ? "[" + (el as HTMLInputElement).type + "]" : ""}`,
        name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30),
        indicated: hasOutline || hasShadow,
      };
    });
    if (!stop) continue;
    stops++;
    if (!stop.indicated) unindicated.push(`${stop.id} "${stop.name}"`);
  }

  expect(stops, "tab traversal found no focusable controls").toBeGreaterThan(50);
  expect(
    [...new Set(unindicated)],
    `${unindicated.length} of ${stops} focus stops had no visible indicator`
  ).toEqual([]);
});

test("the focus ring stays visible on accent-filled controls", async ({ page }) => {
  // The shared ring used to be a single `outline: 2px solid var(--accent)`, which
  // is invisible on anything whose background IS --accent -- the primary CTA, the
  // active region pill, the skip link all measured 1:1. It's now a two-layer
  // box-shadow (background-coloured spacer, then accent), so at least one layer
  // always contrasts. Assert both layers exist rather than re-deriving the maths.
  for (const theme of THEMES) {
    await withTheme(page, theme);
    await page.goto("/", { waitUntil: "load" });
    const cta = page.getByRole("link", { name: /Run your own scenario/i });
    await cta.focus();
    const ring = await cta.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        boxShadow: cs.boxShadow,
        background: cs.backgroundColor,
        layers: (cs.boxShadow.match(/rgb|lab|oklch|#/g) ?? []).length,
      };
    });
    expect(ring.boxShadow, `no ring on the accent CTA in ${theme}`).not.toBe("none");
    expect(
      ring.layers,
      `ring on an accent-filled control needs a contrasting spacer layer (${theme})`
    ).toBeGreaterThanOrEqual(2);
  }
});

// --- Text scaling --------------------------------------------------------

test("nothing overflows when text is scaled to 200%", async ({ page }) => {
  // WCAG 1.4.4 requires no loss of content or functionality at 200% text. The
  // nav collapsed to a hamburger on a viewport-px breakpoint, which cannot see
  // text size, so at 2x the nine desktop links stayed put and pushed the header
  // ~330px past the page edge. The header now wraps, which makes overflow
  // structurally impossible regardless of how the text got bigger.
  for (const route of ROUTES) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(route, { waitUntil: "load" });
    await page.addStyleTag({ content: "html{font-size:32px !important}" });
    await settle(page);
    const { scrollW, docW, offenders } = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const offenders: string[] = [];
      if (document.documentElement.scrollWidth > docW + 1) {
        for (const el of Array.from(document.querySelectorAll("body *"))) {
          const r = el.getBoundingClientRect();
          const p = el.parentElement?.getBoundingClientRect();
          if (r.right > docW + 1 && r.width > 0 && (!p || p.right <= docW + 1)) {
            const cls = typeof el.className === "string" ? el.className.slice(0, 70) : "";
            offenders.push(`<${el.tagName.toLowerCase()}> [${cls}]`);
          }
        }
      }
      return { scrollW: document.documentElement.scrollWidth, docW, offenders };
    });
    expect(
      scrollW,
      `${route} overflows by ${scrollW - docW}px at 200% text:\n  ` +
        offenders.join("\n  ")
    ).toBeLessThanOrEqual(docW + 1);
  }
});

test("content reflows at a 320px viewport", async ({ page }) => {
  // WCAG 1.4.10: 320 CSS px is the 400%-zoom equivalent width.
  for (const route of ROUTES) {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(route, { waitUntil: "load" });
    await settle(page);
    const { scrollW, docW } = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      docW: document.documentElement.clientWidth,
    }));
    expect(scrollW, `${route} overflows at 320px`).toBeLessThanOrEqual(docW + 1);
  }
});
