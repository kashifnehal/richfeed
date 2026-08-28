import { expect, test } from "@playwright/test";
import { CREDS, signIn, trackConsoleErrors } from "./helpers";

test("Settings profile and workspace sub-pages load without error", async ({ page }) => {
  const console_ = trackConsoleErrors(page);
  await signIn(page);
  await page.goto("/settings");

  const tabs = page.locator("nav.shrink-0");

  // Profile (default tab).
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(CREDS.email);
  await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();

  // Workspace tab.
  await tabs.getByRole("button", { name: "Workspace" }).click();
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
  await expect(page.getByLabel("Workspace name")).toBeVisible();

  // Notifications tab.
  await tabs.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText("Notification preferences are coming soon.")).toBeVisible();

  expect(console_.errors).toEqual([]);
});
