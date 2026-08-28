import { expect, test } from "@playwright/test";
import { CREDS, signIn } from "./helpers";

test("sign-in succeeds and lands on the Dashboard", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("bad credentials show an inline error, no redirect", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(CREDS.email);
  await page.getByLabel("Password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});
