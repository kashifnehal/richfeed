import { expect, test, type Page } from "@playwright/test";
import { SIGNUP_CREDS } from "./helpers";

// Auth pages redirect to /dashboard when a session exists — run signed out.
test.use({ storageState: { cookies: [], origins: [] } });

/** Open an auth page and wait for its form to hydrate (see formSignIn for why). */
async function openAuthPage(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "load" });
  await page.waitForTimeout(1500);
}

// global-setup deletes SIGNUP_CREDS.email before the suite, so this creates it fresh.
test("sign-up: a real new account is created and lands in the app", async ({ page }) => {
  test.skip(!SIGNUP_CREDS.email, "E2E_SIGNUP_EMAIL not set");

  await openAuthPage(page, "/sign-up");
  await page.getByLabel("Email").fill(SIGNUP_CREDS.email);
  await page.getByLabel("Password", { exact: true }).fill(SIGNUP_CREDS.password);
  await page.getByLabel("Confirm password").fill(SIGNUP_CREDS.password);
  await page.getByRole("button", { name: "Sign up" }).click();

  // Email confirmations are off on this project → straight into the app.
  // (If they were on, the page shows a "Check your email" state instead.)
  await Promise.race([
    page.waitForURL(/\/dashboard$/, { timeout: 20_000 }),
    page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 20_000 }),
  ]);

  if (new URL(page.url()).pathname === "/dashboard") {
    await expect(page.getByText("Published (7d)", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByText(SIGNUP_CREDS.email)).toBeVisible();
  }
});

test("sign-up: mismatched passwords are rejected client-side", async ({ page }) => {
  await openAuthPage(page, "/sign-up");
  await page.getByLabel("Email").fill("someone@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password-one");
  await page.getByLabel("Confirm password").fill("password-two");

  let signupFired = false;
  page.on("request", (r) => {
    if (r.url().includes("/auth/v1/signup")) signupFired = true;
  });
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page.getByText("Passwords don't match.")).toBeVisible();
  expect(signupFired).toBe(false);
});

test("forgot-password: submitting an email shows the confirmation state", async ({ page }) => {
  await openAuthPage(page, "/forgot-password");
  await page.getByLabel("Email").fill(SIGNUP_CREDS.email || "someone@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(/sent a link to reset your password/i)).toBeVisible();
});
