import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("NotificationBell: a failed-post row navigates to that post's detail", async ({ page }) => {
  await page.getByRole("button", { name: "Notifications" }).click();
  const menu = page.getByRole("menu");
  await menu.getByText("Post failed to publish").first().click();

  await page.waitForURL(/\/posts\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible();
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();
});

test("NotificationBell: the account-reconnect row navigates to Accounts", async ({ page }) => {
  await page.getByRole("button", { name: "Notifications" }).click();
  const menu = page.getByRole("menu");
  await menu.getByText("Account needs reconnect", { exact: true }).first().click();

  await page.waitForURL(/\/accounts$/);
  await expect(page.getByText("Jordan Ellis")).toBeVisible();
});
