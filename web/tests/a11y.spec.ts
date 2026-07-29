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
  "/findings",
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
      await page.waitForTimeout(300);
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
    await page.waitForTimeout(300);
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
