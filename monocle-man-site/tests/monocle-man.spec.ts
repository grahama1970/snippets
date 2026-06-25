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
type Verdict = "PASS" | "FAIL";

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

type InteractionEntry = {
  viewport: ViewportName;
  id: string;
  action: string;
  expected: unknown;
  actual: unknown;
  verdict: Verdict;
  screenshot?: string;
  caveat?: string;
};

type ImageStatusEntry = {
  viewport: ViewportName;
  id: string;
  alt: string;
  src: string;
  currentSrc: string;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  visible: boolean;
  missingFallback: boolean;
  verdict: Verdict;
};

function writeJson(relativePath: string, value: unknown) {
  fs.writeFileSync(path.join(evidenceDir, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function isExpectedStaticServeConsoleMiss(entry: ConsoleEntry) {
  const location = entry.location as { url?: string } | null;
  return entry.type === "error"
    && entry.text.includes("Failed to load resource")
    && typeof location?.url === "string"
    && location.url.includes("/.netlify/images?");
}

async function installEvidenceListeners(
  page: Page,
  viewport: ViewportName,
  baseURL: string | undefined,
  consoleErrors: ConsoleEntry[],
  networkErrors: NetworkEntry[]
) {
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

async function waitForMediaImages(page: Page) {
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".media img"));
    await Promise.all(images.map(image => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>(resolve => {
        const done = () => resolve();
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
        setTimeout(done, 5_000);
      });
    }));
  });
  await page.waitForTimeout(250);
}

async function collectImageStatus(page: Page, viewport: ViewportName): Promise<ImageStatusEntry[]> {
  return await page.locator(".media img").evaluateAll((images, viewportName) => {
    return images.map((node, index) => {
      const image = node as HTMLImageElement;
      const rect = image.getBoundingClientRect();
      const container = image.closest(".media");
      const loaded = image.complete && image.naturalWidth >= 100 && image.naturalHeight >= 75;
      const visible = rect.width > 0 && rect.height > 0;
      const missingFallback = Boolean(container?.classList.contains("missing"));
      return {
        viewport: viewportName as ViewportName,
        id: image.dataset.benchmarkImage || `media-image-${index + 1}`,
        alt: image.alt,
        src: image.getAttribute("src") || "",
        currentSrc: image.currentSrc,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        visible,
        missingFallback,
        verdict: loaded && visible && !missingFallback ? "PASS" : "FAIL"
      };
    });
  }, viewport);
}

async function focusByKeyboard(page: Page, selector: string, maxTabs = 12) {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press("Tab");
    const matched = await page.evaluate(target => document.activeElement?.matches(target) || false, selector);
    if (matched) return true;
  }
  return false;
}

test("Monocle Man renders, interacts, and emits hardened Slice 001 evidence", async ({ browser, baseURL }) => {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const consoleErrors: ConsoleEntry[] = [];
  const networkErrors: NetworkEntry[] = [];
  const interactions: InteractionEntry[] = [];
  const imageStatus: ImageStatusEntry[] = [];
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
    await waitForMediaImages(page);

    const title = await page.title();
    const heroText = await page.locator(".hero-quote").innerText();
    const initialOk = title.includes("The Monocle Man")
      && heroText.toLowerCase().includes("monocle")
      && await page.locator("main h1").isVisible()
      && await page.locator("[data-slice-note]").isVisible();
    interactions.push({
      viewport: viewport.name,
      id: `${viewport.name}:initial-render`,
      action: "render",
      expected: "visible title, hero, and Slice 001 marker",
      actual: { title, heroText, initialOk },
      verdict: initialOk ? "PASS" : "FAIL",
      screenshot: `screenshots/${viewport.name}.png`
    });

    await page.screenshot({
      path: path.join(screenshotsDir, `${viewport.name}.png`),
      fullPage: false
    });
    await page.locator(".hero").screenshot({
      path: path.join(screenshotsDir, `${viewport.name}-hero.png`)
    });

    const viewportImages = await collectImageStatus(page, viewport.name);
    imageStatus.push(...viewportImages);

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    const noOverflow = layout.scrollWidth <= layout.clientWidth + 1;
    interactions.push({
      viewport: viewport.name,
      id: `${viewport.name}:horizontal-overflow`,
      action: "measure-layout",
      expected: "scrollWidth <= clientWidth + 1",
      actual: layout,
      verdict: noOverflow ? "PASS" : "FAIL"
    });

    const reducedMotion = await page.evaluate(() => {
      const play = document.querySelector(".round-play");
      const orbit = document.querySelector(".orbit");
      return {
        mediaMatches: matchMedia("(prefers-reduced-motion: reduce)").matches,
        playAnimation: play ? getComputedStyle(play, "::before").animationName : null,
        orbitAnimation: orbit ? getComputedStyle(orbit, "::before").animationName : null
      };
    });
    const reducedMotionOk = reducedMotion.mediaMatches
      && reducedMotion.playAnimation === "none"
      && reducedMotion.orbitAnimation === "none";
    interactions.push({
      viewport: viewport.name,
      id: `${viewport.name}:reduced-motion`,
      action: "inspect-computed-style",
      expected: { mediaMatches: true, playAnimation: "none", orbitAnimation: "none" },
      actual: reducedMotion,
      verdict: reducedMotionOk ? "PASS" : "FAIL"
    });

    const externalLink = page.locator("a[href*='youtube.com/watch']");
    const externalLinkState = {
      href: await externalLink.getAttribute("href"),
      target: await externalLink.getAttribute("target"),
      rel: await externalLink.getAttribute("rel")
    };
    const externalLinkOk = externalLinkState.href?.includes("NBxByrz5BRE") === true
      && externalLinkState.target === "_blank"
      && externalLinkState.rel?.includes("noopener") === true;
    interactions.push({
      viewport: viewport.name,
      id: `${viewport.name}:external-film-link`,
      action: "inspect-link",
      expected: "correct film URL with target=_blank and noopener",
      actual: externalLinkState,
      verdict: externalLinkOk ? "PASS" : "FAIL"
    });

    if (viewport.name === "desktop") {
      const focused = await focusByKeyboard(page, "button[data-open-video]");
      const focusVisible = focused && await page.evaluate(() => document.activeElement?.matches(":focus-visible") || false);
      interactions.push({
        viewport: viewport.name,
        id: "desktop:watch-film-keyboard-focus",
        action: "tab-to-control",
        expected: "watch-film button receives visible keyboard focus",
        actual: { focused, focusVisible },
        verdict: focused && focusVisible ? "PASS" : "FAIL"
      });

      await page.keyboard.press("Enter");
      const dialog = page.locator("dialog[data-modal]");
      const dialogOpened = await dialog.evaluate(element => (element as HTMLDialogElement).open);
      const modalSrc = await page.locator("[data-modal-frame]").getAttribute("src");
      await page.screenshot({
        path: path.join(screenshotsDir, "desktop-modal.png"),
        fullPage: false
      });
      interactions.push({
        viewport: viewport.name,
        id: "desktop:open-video-modal",
        action: "keyboard-enter",
        expected: "dialog open with privacy-enhanced YouTube source",
        actual: { dialogOpened, modalSrc },
        verdict: dialogOpened && modalSrc?.includes("youtube-nocookie") ? "PASS" : "FAIL",
        screenshot: "screenshots/desktop-modal.png"
      });

      await page.keyboard.press("Escape");
      const dialogClosed = !(await dialog.evaluate(element => (element as HTMLDialogElement).open));
      interactions.push({
        viewport: viewport.name,
        id: "desktop:close-video-modal",
        action: "keyboard-escape",
        expected: "dialog closed",
        actual: { dialogClosed },
        verdict: dialogClosed ? "PASS" : "FAIL"
      });
    }

    if (viewport.name === "mobile") {
      const menu = page.locator("[data-menu]");
      await menu.click();
      const expanded = await menu.getAttribute("aria-expanded");
      await page.screenshot({
        path: path.join(screenshotsDir, "mobile-menu.png"),
        fullPage: false
      });
      await page.locator("[data-links] a[href='#film']").click();
      const collapsed = await menu.getAttribute("aria-expanded");
      interactions.push({
        viewport: viewport.name,
        id: "mobile:menu-open-navigate-close",
        action: "click-menu-and-film-link",
        expected: { expanded: "true", collapsed: "false" },
        actual: { expanded, collapsed },
        verdict: expanded === "true" && collapsed === "false" ? "PASS" : "FAIL",
        screenshot: "screenshots/mobile-menu.png"
      });
    }

    await page.addScriptTag({ content: axeSource });
    const axeResults = await page.evaluate(async () => {
      return await (window as unknown as { axe: { run: (context?: unknown, options?: unknown) => Promise<unknown> } }).axe.run(document, {
        resultTypes: ["violations", "incomplete"]
      });
    });
    (accessibility.scans as unknown[]).push({
      viewport: viewport.name,
      result: axeResults
    });

    await page.locator("#lines").scrollIntoViewIfNeeded();
    await page.locator("#lines").screenshot({
      path: path.join(screenshotsDir, `${viewport.name}-lines.png`)
    });
    await page.screenshot({
      path: path.join(screenshotsDir, `${viewport.name}-full.png`),
      fullPage: true
    });

    await context.close();
  }

  writeJson("console-errors.json", {
    schema: "chatgpt_lab.console_errors.v1",
    generated_at: new Date().toISOString(),
    errors: consoleErrors
  });
  writeJson("network-errors.json", {
    schema: "chatgpt_lab.network_errors.v1",
    generated_at: new Date().toISOString(),
    errors: networkErrors
  });
  writeJson("accessibility.json", accessibility);
  writeJson("interactions.json", {
    schema: "chatgpt_lab.interactions.v1",
    generated_at: new Date().toISOString(),
    interactions
  });
  writeJson("image-status.json", {
    schema: "chatgpt_lab.image_status.v1",
    generated_at: new Date().toISOString(),
    images: imageStatus
  });

  const unexpectedConsoleErrors = consoleErrors.filter(entry => !isExpectedStaticServeConsoleMiss(entry));
  const blockingNetworkErrors = networkErrors.filter(entry => entry.severity === "error");
  const failedInteractions = interactions.filter(entry => entry.verdict === "FAIL");
  const failedImages = imageStatus.filter(entry => entry.verdict === "FAIL");
  const blockingA11yViolations = (accessibility.scans as any[])
    .flatMap(scan => scan.result?.violations || [])
    .filter(violation => violation.impact === "critical" || violation.impact === "serious");

  expect.soft(unexpectedConsoleErrors, "unexpected console errors").toEqual([]);
  expect.soft(blockingNetworkErrors, "same-origin network failures").toEqual([]);
  expect.soft(failedInteractions, "deterministic interaction failures").toEqual([]);
  expect.soft(failedImages, "required media images must load and remain visible").toEqual([]);
  expect.soft(blockingA11yViolations, "critical or serious accessibility violations").toEqual([]);
});
