import { test, expect } from "@playwright/test";

test("Monocle Man decorative animation runs in normal motion mode", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "no-preference",
    baseURL
  });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const animation = await page.evaluate(() => {
    const play = document.querySelector(".round-play");
    if (!play) return null;
    const style = getComputedStyle(play, "::before");
    return {
      motionPreference: matchMedia("(prefers-reduced-motion: no-preference)").matches,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationIterationCount: style.animationIterationCount
    };
  });

  expect(animation).not.toBeNull();
  expect(animation?.motionPreference).toBe(true);
  expect(animation?.animationName).toBe("spin");
  expect(animation?.animationDuration).not.toBe("0s");
  expect(animation?.animationIterationCount).toBe("infinite");

  await context.close();
});
