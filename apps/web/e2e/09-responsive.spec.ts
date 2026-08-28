import { expect, test } from "@playwright/test";
import { signIn, trackConsoleErrors } from "./helpers";

const PAGES = ["/dashboard", "/calendar", "/queue", "/accounts", "/posts/new", "/settings"];
const VIEWPORTS = [
  { name: "sm", width: 375, height: 780 },
  { name: "md", width: 768, height: 900 },
  { name: "lg", width: 1024, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`no layout/render regressions at ${vp.name} (${vp.width}px)`, async ({ page }) => {
    const console_ = trackConsoleErrors(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await signIn(page);

    for (const path of PAGES) {
      await page.goto(path);
      // Main content mounted (past the "Loading..." state where applicable).
      await expect(page.locator("main")).toBeVisible();
      await page.waitForLoadState("networkidle");

      // The page body must not scroll horizontally.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows horizontally at ${vp.name}`).toBeLessThanOrEqual(1);
    }

    expect(console_.errors).toEqual([]);
  });
}
