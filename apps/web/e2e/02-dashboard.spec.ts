import { expect, test } from "@playwright/test";
import { signIn, statTileValue } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("stat tiles show real non-zero numbers", async ({ page }) => {
  expect(await statTileValue(page, "Published (7d)")).toBeGreaterThan(0);
  // Seeded: 5 failed + 1 needs_reconnect target = 6 (doc 49's fix folds in needs_reconnect).
  expect(await statTileValue(page, "Failed — needs attention")).toBe(6);
  // Seeded: exactly one account in needs_reconnect (Jordan Ellis / LinkedIn).
  expect(await statTileValue(page, "Accounts needing reconnect")).toBe(1);
});

test("AttentionList lists BOTH failed and needs_reconnect items (doc 49 fix holds)", async ({
  page,
}) => {
  const section = page.locator("section", { hasText: "Needs your attention" });
  await expect(section.getByText("Post failed to publish").first()).toBeVisible();
  // The distinct target-level needs_reconnect label doc 49 added.
  await expect(section.getByText("Target needs account reconnect").first()).toBeVisible();
  // And the account-level reconnect row.
  await expect(section.getByText("Account needs reconnect").first()).toBeVisible();
});

test("NotificationBell shows an unread badge and opens with real rows", async ({ page }) => {
  const bell = page.getByRole("button", { name: "Notifications" });
  // The unread indicator is a small pill dot rendered only when items exist.
  await expect(bell.locator("span.rounded-pill")).toBeVisible();

  await bell.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByText("Post failed to publish").first()).toBeVisible();
  const items = menu.getByRole("menuitem");
  expect(await items.count()).toBeGreaterThanOrEqual(6);
});
