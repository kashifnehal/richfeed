import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/accounts");
});

test("all 9 seeded accounts render with a status pill", async ({ page }) => {
  const pills = page.getByText(/^(Connected|Needs reconnect|Limited)$/);
  await expect(pills.first()).toBeVisible();
  expect(await pills.count()).toBe(9);
});

test("per-account status badge matches the seeded status", async ({ page }) => {
  const card = (name: string) =>
    page.locator("div.rounded-card").filter({ hasText: name });

  await expect(card("Avery Chen").getByText("Connected", { exact: true })).toBeVisible();
  await expect(card("Jordan Ellis").getByText("Needs reconnect", { exact: true })).toBeVisible();
  // The TikTok account is seeded as "limited".
  await expect(
    card("RichFeed").filter({ hasText: "TikTok" }).getByText("Limited", { exact: true }),
  ).toBeVisible();
});
