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

type NetworkEntry = { viewport: ViewportName; url: string; method: string; resourceType: string; failureText: string | null; severity: "error" | "warning"; };
type ConsoleEntry = { viewport: ViewportName; type: string; text: string; location: unknown; };
type InteractionEntry = { viewport: ViewportName; id: string; action: string; expected: unknown; actual: unknown; verdict: Verdict; screenshot?: string; caveat?: string; };
type ImageStatusEntry = { viewport: ViewportName; id: string; alt: string; src: string; currentSrc: string; complete: boolean; naturalWidth: number; naturalHeight: number; visible: boolean; missingFallback: boolean; verdict: Verdict; };

const REQUIRED_QIDS = [
  "monocle:app:root", "monocle:main:content", "monocle:progress:scroll",
  "monocle:hero:section", "monocle:hero:eyebrow", "monocle:hero:heading", "monocle:hero:quote", "monocle:hero:image-frame", "monocle:hero:image",
  "monocle:film:section", "monocle:film:embed-frame", "monocle:film:note", "monocle:film:metadata",
  "monocle:rules:section", "monocle:rules:heading", "monocle:rules:item:one-side", "monocle:rules:item:never-waver", "monocle:rules:item:etiquette",
  "monocle:quotes:gallery", "monocle:quotes:card:inspection", "monocle:quotes:image:inspection", "monocle:quotes:card:adjustment", "monocle:quotes:image:adjustment", "monocle:quotes:card:final-warning", "monocle:quotes:image:final-warning",
  "monocle:verdict:section", "monocle:verdict:image:background", "monocle:verdict:quote", "monocle:verdict:heading",
  "monocle:modal:video", "monocle:footer:credit", "monocle:evidence:slice-note"
] as const;

const INTERACTIVE_CONTRACT = [
  ["monocle:skip:main", "MONOCLE_SKIP_MAIN", "Skip to main content"],
  ["monocle:nav:brand-top", "MONOCLE_NAV_TOP", "Return to top"],
  ["monocle:nav:film", "MONOCLE_NAV_FILM", "Jump to the film section"],
  ["monocle:nav:rules", "MONOCLE_NAV_RULES", "Jump to monocle rules"],
  ["monocle:nav:lines", "MONOCLE_NAV_LINES", "Jump to quoted lines"],
  ["monocle:nav:menu-toggle", "MONOCLE_MENU_TOGGLE", "Open navigation menu"],
  ["monocle:nav:watch-film", "MONOCLE_VIDEO_OPEN_HEADER", "Open the film modal"],
  ["monocle:hero:watch-film", "MONOCLE_VIDEO_OPEN_HERO", "Watch the original monocle film"],
  ["monocle:film:external-original", "MONOCLE_ORIGINAL_OPEN_FILM", "Open the original film on YouTube"],
  ["monocle:verdict:watch-original", "MONOCLE_ORIGINAL_OPEN_FINAL", "Watch the original film"],
  ["monocle:modal:close", "MONOCLE_VIDEO_CLOSE", "Close film modal"],
  ["monocle:footer:top", "MONOCLE_FOOTER_TOP", "Return to top"],
  ["monocle:footer:film", "MONOCLE_FOOTER_FILM", "Jump to film section"],
  ["monocle:footer:lines", "MONOCLE_FOOTER_LINES", "Jump to quoted lines"]
] as const;

const DESKTOP_TAB_QIDS = [
  "monocle:skip:main", "monocle:nav:brand-top", "monocle:nav:film", "monocle:nav:rules", "monocle:nav:lines", "monocle:nav:watch-film",
  "monocle:hero:watch-film", "monocle:film:external-original", "monocle:verdict:watch-original", "monocle:footer:top", "monocle:footer:film", "monocle:footer:lines"
];

function writeJson(relativePath: string, value: unknown) {
  fs.writeFileSync(path.join(evidenceDir, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}
function qidSelector(qid: string) { return `[data-qid="${qid}"]`; }
function normalizeText(value: string) { return value.replace(/\s+/g, " ").trim(); }
function record(interactions: InteractionEntry[], viewport: ViewportName, id: string, action: string, expected: unknown, actual: unknown, ok: boolean, screenshot?: string) {
  interactions.push({ viewport, id, action, expected, actual, verdict: ok ? "PASS" : "FAIL", screenshot });
}
function isExpectedStaticServeConsoleMiss(entry: ConsoleEntry) {
  const location = entry.location as { url?: string } | null;
  return entry.type === "error" && entry.text.includes("Failed to load resource") && typeof location?.url === "string" && location.url.includes("/.netlify/images?");
}
async function currentQid(page: Page) {
  return await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.qid || null);
}
async function blurActive(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}
async function installEvidenceListeners(page: Page, viewport: ViewportName, baseURL: string | undefined, consoleErrors: ConsoleEntry[], networkErrors: NetworkEntry[]) {
  const baseUrl = new URL(baseURL || "http://127.0.0.1:4173");
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push({ viewport, type: message.type(), text: message.text(), location: message.location() });
  });
  page.on("pageerror", error => consoleErrors.push({ viewport, type: "pageerror", text: error.message, location: null }));
  page.on("requestfailed", request => {
    const requestUrl = new URL(request.url());
    networkErrors.push({ viewport, url: request.url(), method: request.method(), resourceType: request.resourceType(), failureText: request.failure()?.errorText || null, severity: requestUrl.origin === baseUrl.origin ? "error" : "warning" });
  });
}
async function waitForMediaImages(page: Page) {
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".media img"));
    await Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => {
      const done = () => resolve();
      image.addEventListener("load", done, { once: true });
      image.addEventListener("error", done, { once: true });
      setTimeout(done, 5_000);
    })));
  });
  await page.waitForTimeout(250);
}
async function collectImageStatus(page: Page, viewport: ViewportName): Promise<ImageStatusEntry[]> {
  return await page.locator(".media img").evaluateAll((images, viewportName) => images.map((node, index) => {
    const image = node as HTMLImageElement;
    const rect = image.getBoundingClientRect();
    const container = image.closest(".media");
    const loaded = image.complete && image.naturalWidth >= 100 && image.naturalHeight >= 75;
    const visible = rect.width > 0 && rect.height > 0;
    const missingFallback = Boolean(container?.classList.contains("missing"));
    return { viewport: viewportName as ViewportName, id: image.dataset.benchmarkImage || `media-image-${index + 1}`, alt: image.alt, src: image.getAttribute("src") || "", currentSrc: image.currentSrc, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, visible, missingFallback, verdict: loaded && visible && !missingFallback ? "PASS" : "FAIL" };
  }), viewport);
}
async function clickAndWaitForScroll(page: Page, qid: string, targetQid: string) {
  await page.locator(qidSelector(qid)).click();
  await page.locator(qidSelector(targetQid)).scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const box = await page.locator(qidSelector(targetQid)).boundingBox();
  return Boolean(box && box.y < 920 && box.y > -120);
}

test("Monocle Man React SPA satisfies the deterministic contract and emits evidence", async ({ browser, baseURL }) => {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  const consoleErrors: ConsoleEntry[] = [];
  const networkErrors: NetworkEntry[] = [];
  const interactions: InteractionEntry[] = [];
  const imageStatus: ImageStatusEntry[] = [];
  const accessibility: Record<string, unknown> = { schema: "chatgpt_lab.accessibility_report.v1", generated_at: new Date().toISOString(), scans: [] };

  const viewports: Array<{ name: ViewportName; width: number; height: number; isMobile: boolean }> = [
    { name: "desktop", width: 1440, height: 1100, isMobile: false },
    { name: "mobile", width: 390, height: 844, isMobile: true }
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, reducedMotion: "reduce", colorScheme: "light", baseURL });
    const page = await context.newPage();
    await installEvidenceListeners(page, viewport.name, baseURL, consoleErrors, networkErrors);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Array.isArray((window as any).__MONOCLE_ACTION_REGISTRY__) && (window as any).__MONOCLE_ACTION_REGISTRY__.length >= 14);
    await waitForMediaImages(page);

    const title = await page.title();
    const qidCounts = Object.fromEntries(await Promise.all(REQUIRED_QIDS.map(async qid => [qid, await page.locator(qidSelector(qid)).count()])));
    const missingRequiredQids = Object.entries(qidCounts).filter(([, count]) => count !== 1);
    const headingText = normalizeText(await page.locator(qidSelector("monocle:hero:heading")).innerText());
    const quoteText = await page.locator(qidSelector("monocle:hero:quote")).innerText();
    const heroVisible = await page.locator(qidSelector("monocle:hero:section")).isVisible();
    record(interactions, viewport.name, `${viewport.name}:contract-qids`, "inspect-dom", "all required static data-qid elements exist once", { title, missingRequiredQids, headingText, quoteText, heroVisible }, missingRequiredQids.length === 0 && heroVisible && headingText.includes("The Monocle Man") && quoteText.toLowerCase().includes("monocle"), `screenshots/${viewport.name}.png`);

    const interactiveState = await Promise.all(INTERACTIVE_CONTRACT.map(async ([qid, action, title]) => {
      const locator = page.locator(qidSelector(qid));
      return { qid, count: await locator.count(), action: await locator.first().getAttribute("data-qs-action"), title: await locator.first().getAttribute("title"), expectedAction: action, expectedTitle: title };
    }));
    const interactiveFailures = interactiveState.filter(item => item.count !== 1 || item.action !== item.expectedAction || item.title !== item.expectedTitle);
    record(interactions, viewport.name, `${viewport.name}:interactive-instrumentation`, "inspect-dom", "each interactive element has qid, action, title", { interactiveFailures }, interactiveFailures.length === 0);

    const registry = await page.evaluate(() => (window as any).__MONOCLE_ACTION_REGISTRY__ || []);
    const registeredActions = registry.map((entry: { action: string }) => entry.action).sort();
    const expectedActions = INTERACTIVE_CONTRACT.map(([, action]) => action).sort();
    const missingRegisteredActions = expectedActions.filter(action => !registeredActions.includes(action));
    record(interactions, viewport.name, `${viewport.name}:action-registry`, "inspect-window-registry", "all contract actions registered by hook", { registeredActions, missingRegisteredActions }, missingRegisteredActions.length === 0);

    await page.screenshot({ path: path.join(screenshotsDir, `${viewport.name}.png`), fullPage: false });
    await page.locator(qidSelector("monocle:hero:section")).screenshot({ path: path.join(screenshotsDir, `${viewport.name}-hero.png`) });
    imageStatus.push(...await collectImageStatus(page, viewport.name));

    const beforeProgress = await page.locator(qidSelector("monocle:progress:scroll")).evaluate(node => getComputedStyle(node as HTMLElement).width);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    const afterProgress = await page.locator(qidSelector("monocle:progress:scroll")).evaluate(node => getComputedStyle(node as HTMLElement).width);
    record(interactions, viewport.name, `${viewport.name}:scroll-progress`, "scroll-page", "scroll progress width increases after scroll", { beforeProgress, afterProgress }, parseFloat(afterProgress) > parseFloat(beforeProgress));
    await page.evaluate(() => window.scrollTo(0, 0));

    const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    record(interactions, viewport.name, `${viewport.name}:horizontal-overflow`, "measure-layout", "scrollWidth <= clientWidth + 1", layout, layout.scrollWidth <= layout.clientWidth + 1);

    const reducedMotion = await page.evaluate(() => ({ mediaMatches: matchMedia("(prefers-reduced-motion: reduce)").matches, playAnimation: getComputedStyle(document.querySelector(".round-play")!, "::before").animationName }));
    record(interactions, viewport.name, `${viewport.name}:reduced-motion`, "inspect-computed-style", { mediaMatches: true, playAnimation: "none" }, reducedMotion, reducedMotion.mediaMatches && reducedMotion.playAnimation === "none");

    const externalLinks = await Promise.all(["monocle:film:external-original", "monocle:verdict:watch-original"].map(async qid => {
      const locator = page.locator(qidSelector(qid));
      return { qid, href: await locator.getAttribute("href"), target: await locator.getAttribute("target"), rel: await locator.getAttribute("rel") };
    }));
    const badExternalLinks = externalLinks.filter(link => !link.href?.includes("NBxByrz5BRE") || link.target !== "_blank" || !link.rel?.includes("noopener"));
    record(interactions, viewport.name, `${viewport.name}:external-film-links`, "inspect-links", "YouTube links use expected video id, _blank, and noopener", { externalLinks, badExternalLinks }, badExternalLinks.length === 0);

    if (viewport.name === "desktop") {
      await blurActive(page);
      await page.keyboard.press("Tab");
      const skipFocused = await currentQid(page);
      const focusVisible = await page.evaluate(() => document.activeElement?.matches(":focus-visible") || false);
      await page.keyboard.press("Enter");
      const mainFocused = await currentQid(page);
      record(interactions, viewport.name, "desktop:skip-link-focus", "keyboard-skip", "skip link receives visible focus and moves focus to main", { skipFocused, focusVisible, mainFocused }, skipFocused === "monocle:skip:main" && focusVisible && mainFocused === "monocle:main:content");

      await page.evaluate(() => window.scrollTo(0, 0));
      const filmNavOk = await clickAndWaitForScroll(page, "monocle:nav:film", "monocle:film:section");
      const rulesNavOk = await clickAndWaitForScroll(page, "monocle:nav:rules", "monocle:rules:section");
      const linesNavOk = await clickAndWaitForScroll(page, "monocle:nav:lines", "monocle:quotes:gallery");
      await page.locator(qidSelector("monocle:nav:brand-top")).click();
      await page.waitForFunction(() => window.scrollY < 20);
      record(interactions, viewport.name, "desktop:navigation-targets", "click-nav-links", "Film, Rules, Lines, and Top navigation moves to target sections", { filmNavOk, rulesNavOk, linesNavOk, scrollY: await page.evaluate(() => window.scrollY) }, filmNavOk && rulesNavOk && linesNavOk);

      await page.locator(qidSelector("monocle:hero:watch-film")).click();
      const dialog = page.locator(qidSelector("monocle:modal:video"));
      const dialogOpened = await dialog.evaluate(element => (element as HTMLDialogElement).open);
      const modalSrc = await page.locator(qidSelector("monocle:modal:iframe")).getAttribute("src");
      const modalFocusQid = await currentQid(page);
      await page.screenshot({ path: path.join(screenshotsDir, "desktop-modal.png"), fullPage: false });
      record(interactions, viewport.name, "desktop:hero-opens-video-modal", "click-hero-watch", "dialog opens, focus moves inside, iframe uses youtube-nocookie", { dialogOpened, modalSrc, modalFocusQid }, dialogOpened && modalSrc?.includes("youtube-nocookie") === true && modalFocusQid === "monocle:modal:close", "screenshots/desktop-modal.png");

      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !(document.querySelector('[data-qid="monocle:modal:video"]') as HTMLDialogElement | null)?.open);
      const iframeAbsentAfterEscape = await page.locator(qidSelector("monocle:modal:iframe")).count() === 0;
      const focusReturnedToHero = await currentQid(page);
      record(interactions, viewport.name, "desktop:escape-closes-video-modal", "keyboard-escape", "Escape closes dialog, removes iframe src, returns focus", { iframeAbsentAfterEscape, focusReturnedToHero }, iframeAbsentAfterEscape && focusReturnedToHero === "monocle:hero:watch-film");

      await page.locator(qidSelector("monocle:nav:watch-film")).click();
      const headerDialogOpened = await dialog.evaluate(element => (element as HTMLDialogElement).open);
      await page.locator(qidSelector("monocle:modal:close")).click();
      await page.waitForFunction(() => !(document.querySelector('[data-qid="monocle:modal:video"]') as HTMLDialogElement | null)?.open);
      const focusReturnedToHeader = await currentQid(page);
      record(interactions, viewport.name, "desktop:header-open-close-button", "click-header-watch-and-close", "header opens modal and close button returns focus", { headerDialogOpened, focusReturnedToHeader }, headerDialogOpened && focusReturnedToHeader === "monocle:nav:watch-film");

      await page.evaluate(() => window.scrollTo(0, 0));
      await blurActive(page);
      const tabbedQids: string[] = [];
      for (let index = 0; index < 80; index += 1) {
        await page.keyboard.press("Tab");
        const qid = await currentQid(page);
        if (qid) tabbedQids.push(qid);
      }
      const missingTabbedQids = DESKTOP_TAB_QIDS.filter(qid => !tabbedQids.includes(qid));
      record(interactions, viewport.name, "desktop:keyboard-tab-reaches-visible-controls", "keyboard-tab-sequence", "Tab reaches every visible desktop interactive control", { tabbedQids: Array.from(new Set(tabbedQids)), missingTabbedQids }, missingTabbedQids.length === 0);
    }

    if (viewport.name === "mobile") {
      const menu = page.locator(qidSelector("monocle:nav:menu-toggle"));
      await menu.click();
      const expanded = await menu.getAttribute("aria-expanded");
      await page.screenshot({ path: path.join(screenshotsDir, "mobile-menu.png"), fullPage: false });
      await page.locator(qidSelector("monocle:nav:film")).click();
      const collapsed = await menu.getAttribute("aria-expanded");
      const filmVisible = await page.locator(qidSelector("monocle:film:section")).isVisible();
      record(interactions, viewport.name, "mobile:menu-open-navigate-close", "click-menu-and-film-link", { expanded: "true", collapsed: "false", filmVisible: true }, { expanded, collapsed, filmVisible }, expanded === "true" && collapsed === "false" && filmVisible, "screenshots/mobile-menu.png");
    }

    await page.addScriptTag({ content: axeSource });
    const axeResults = await page.evaluate(async () => await (window as unknown as { axe: { run: (context?: unknown, options?: unknown) => Promise<unknown> } }).axe.run(document, { resultTypes: ["violations", "incomplete"], rules: { "color-contrast": { enabled: true } } }));
    (accessibility.scans as unknown[]).push({ viewport: viewport.name, result: axeResults });
    await page.locator(qidSelector("monocle:quotes:gallery")).scrollIntoViewIfNeeded();
    await page.locator(qidSelector("monocle:quotes:gallery")).screenshot({ path: path.join(screenshotsDir, `${viewport.name}-lines.png`) });
    await page.screenshot({ path: path.join(screenshotsDir, `${viewport.name}-full.png`), fullPage: true });
    await context.close();
  }

  writeJson("console-errors.json", { schema: "chatgpt_lab.console_errors.v1", generated_at: new Date().toISOString(), errors: consoleErrors });
  writeJson("network-errors.json", { schema: "chatgpt_lab.network_errors.v1", generated_at: new Date().toISOString(), errors: networkErrors });
  writeJson("accessibility.json", accessibility);
  writeJson("interactions.json", { schema: "chatgpt_lab.interactions.v1", generated_at: new Date().toISOString(), interactions });
  writeJson("image-status.json", { schema: "chatgpt_lab.image_status.v1", generated_at: new Date().toISOString(), images: imageStatus });

  const unexpectedConsoleErrors = consoleErrors.filter(entry => !isExpectedStaticServeConsoleMiss(entry));
  const blockingNetworkErrors = networkErrors.filter(entry => entry.severity === "error");
  const failedInteractions = interactions.filter(entry => entry.verdict === "FAIL");
  const failedImages = imageStatus.filter(entry => entry.verdict === "FAIL");
  const blockingA11yViolations = (accessibility.scans as any[]).flatMap(scan => scan.result?.violations || []).filter(violation => violation.impact === "critical" || violation.impact === "serious");

  expect.soft(unexpectedConsoleErrors, "unexpected console errors").toEqual([]);
  expect.soft(blockingNetworkErrors, "same-origin network failures").toEqual([]);
  expect.soft(failedInteractions, "deterministic interaction failures").toEqual([]);
  expect.soft(failedImages, "required media images must load and remain visible").toEqual([]);
  expect.soft(blockingA11yViolations, "critical or serious accessibility violations").toEqual([]);
});
