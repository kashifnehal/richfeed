import { expect, test } from "@playwright/test";
import { signIn, trackConsoleErrors } from "./helpers";

test("calendar renders month and week views with post chips, no errors", async ({ page }) => {
  const console_ = trackConsoleErrors(page);
  await signIn(page);
  await page.goto("/calendar");

  const grid = page.locator("div.md\\:block").first();

  // Month view (default).
  await expect(page.getByRole("button", { name: "month" })).toBeVisible();
  await expect(grid.getByText("Wed", { exact: true }).first()).toBeVisible();
  await expect(grid.locator('a[href^="/posts/"]').first()).toBeVisible();
  const monthChips = await grid.locator('a[href^="/posts/"]').count();
  expect(monthChips).toBeGreaterThan(0);

  // Switch to week view.
  await page.getByRole("button", { name: "week" }).click();
  await expect(grid.getByText("Wed", { exact: true }).first()).toBeVisible();
  // The current week holds mid-flight + later-today/tomorrow seeded targets.
  await expect(grid.locator('a[href^="/posts/"]').first()).toBeVisible();

  // Back to month.
  await page.getByRole("button", { name: "month" }).click();
  await expect(grid.locator('a[href^="/posts/"]').first()).toBeVisible();

  expect(console_.errors).toEqual([]);
});
