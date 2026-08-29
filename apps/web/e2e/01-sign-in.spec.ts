import { expect, test } from "@playwright/test";
import { CREDS, formSignIn } from "./helpers";

// These exercise the real sign-in form, so start signed out.
test.use({ storageState: { cookies: [], origins: [] } });

test("sign-in succeeds and lands on the Dashboard", async ({ page }) => {
  await formSignIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Published (7d)", { exact: true })).toBeVisible({ timeout: 45_000 });
});

test("bad credentials show an inline error, no redirect", async ({ page }) => {
  await page.goto("/sign-in", { waitUntil: "load" });
  await page.waitForTimeout(1500); // let the form hydrate before submitting
  await page.getByLabel("Email").fill(CREDS.email);
  await page.getByLabel("Password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});
