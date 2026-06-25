import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const axeSource = fs.readFileSync(axePath, "utf8");

const evidenceDir = process.env.BENCHMARK_EVIDENCE_DIR || "benchmark-evidence";
const screenshotsDir = path.join(evidenceDir, "screenshots");

type ViewportName = "desktop" | "mobile";

type NetworkEntry = {
  viewport: ViewportName;
  url: string;
  method: string;
  resourceType: string;
  failureText: string | null;
  severity: "error" | "warning";
};

type ConsoleEntry = {
  viewport: ViewportName;
  type: string;
  text: string;
  location: unknown;
};

function isExpectedStaticServeConsoleMiss(entry: ConsoleEntry) {
  const location = entry.location as { url?: string } | null;
  return entry.type === "error"
    && entry.text.includes("Failed to load resource")
    && typeof location?.url === "string"
    && location.url.includes("/.netlify/images?");
}

async function installEvidenceListeners(page: Page, viewport: ViewportName, baseURL: string | undefined, consoleErrors: ConsoleEntry[], networkErrors: NetworkEntry[]) {
  const baseUrl = new URL(baseURL || "http://127.0.0.1:4173");

  page.on("console", message => {
    if (message.type() === "error") {
      consoleErrors.push({
        viewport,
        type: message.type(),
        text: message.text(),
        location: message.location()
      });
    }
  });

  page.on("pageerror", error => {
    consoleErrors.push({
      viewport,
      type: "pageerror",
      text: error.message,
      location: null
    });
  });

  page.on("requestfailed", request => {
    const requestUrl = new URL(request.url());
    const sameOrigin = requestUrl.origin === baseUrl.origin;
    networkErrors.push({
      viewport,
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      failureText: request.failure()?.errorText || null,
      severity: sameOrigin ? "error" : "warning"
    });
  });
}

test("Monocle Man renders, interacts, and emits Slice 001 evidence", async ({ browser, baseURL }) => {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const consoleErrors: ConsoleEntry[] = [];
  const networkErrors: NetworkEntry[] = [];
  const interactions: unknown[] = [];
  const accessibility: Record<string, unknown> = {
    schema: "chatgpt_lab.accessibility_report.v1",
    generated_at: new Date().toISOString(),
    scans: []
  };

  const viewports: Array<{ name: ViewportName; width: number; height: number; isMobile: boolean }> = [
    { name: "desktop", width: 1440, height: 1100, isMobile: false },
    { name: "mobile", width: 390, height: 844, isMobile: true }
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      reducedMotion: "reduce",
      colorScheme: "light",
      baseURL
    });
    const page = await context.newPage();
    await installEvidenceListeners(page, viewport.name, baseURL, consoleErrors, networkErrors);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main h1")).toContainText("Monocle");
    await expect(page.locator("[data-slice-note]")).toContainText("Slice 001 evidence build");

    const title = await page.title();
    const heroText = await page.locator(".hero-quote").innerText();
    interactions.push({
      viewport: viewport.name,
      action: "initial_render",
      ok: title.includes("The Monocle Man") && heroText.includes("monocle"),
      title,
      heroText
    });

    if (viewport.name === "desktop") {
      await page.locator("button[data-open-video]").first().click();
      const dialog = page.locator("dialog[data-modal]");
      await expect(dialog).toHaveJSProperty("open", true);
      await expect(page.locator("[data-modal-frame]")).toHaveAttribute("src", /youtube-nocookie/);
      interactions.push({
        viewport: viewport.name,
        action: "open_video_modal",
        ok: true
      });

      await page.locator("[data-close]").click();
      await expect(dialog).toHaveJSProperty("open", false);
      interactions.push({
        viewport: viewport.name,
        action: "close_video_modal",
        ok: true
      });
    }

    if (viewport.name === "mobile") {
      const menu = page.locator("[data-menu]");
      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await page.locator("[data-links] a[href='#film']").click();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      interactions.push({
        viewport: viewport.name,
        action: "mobile_menu_open_and_close",
        ok: true
      });
    }

    await page.addScriptTag({ content: axeSource });
    const axeResults = await page.evaluate(async () => {
      return await (window as unknown as { axe: { run: (context?: unknown, options?: unknown) => Promise<unknown> } }).axe.run(document, {
        resultTypes: ["violations"],
        rules: {
          "color-contrast": { enabled: false }
        }
      });
    });

    (accessibility.scans as unknown[]).push({
      viewport: viewport.name,
      result: axeResults
    });

    await page.screenshot({
      path: path.join(screenshotsDir, `${viewport.name}.png`),
      fullPage: true
    });

    await context.close();
  }

  fs.writeFileSync(path.join(evidenceDir, "console-errors.json"), JSON.stringify({
    schema: "chatgpt_lab.console_errors.v1",
    generated_at: new Date().toISOString(),
    errors: consoleErrors
  }, null, 2));

  fs.writeFileSync(path.join(evidenceDir, "network-errors.json"), JSON.stringify({
    schema: "chatgpt_lab.network_errors.v1",
    generated_at: new Date().toISOString(),
    errors: networkErrors
  }, null, 2));

  fs.writeFileSync(path.join(evidenceDir, "accessibility.json"), JSON.stringify(accessibility, null, 2));

  fs.writeFileSync(path.join(evidenceDir, "interactions.json"), JSON.stringify({
    schema: "chatgpt_lab.interactions.v1",
    generated_at: new Date().toISOString(),
    interactions
  }, null, 2));

  const blockingNetworkErrors = networkErrors.filter(entry => entry.severity === "error");
  const criticalA11yViolations = (accessibility.scans as any[])
    .flatMap(scan => scan.result?.violations || [])
    .filter(violation => violation.impact === "critical");

  expect(consoleErrors.filter(entry => !isExpectedStaticServeConsoleMiss(entry))).toEqual([]);
  expect(blockingNetworkErrors).toEqual([]);
  expect(criticalA11yViolations).toEqual([]);
});
