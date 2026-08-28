import { expect, type Page } from "@playwright/test";

export const CREDS = {
  email: process.env.E2E_USER_EMAIL!,
  password: process.env.E2E_USER_PASSWORD!,
};

/** Signs in through the real UI and waits for the Dashboard to finish loading. */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(CREDS.email);
  await page.getByLabel("Password").fill(CREDS.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
  await expect(page.getByText("Published (7d)", { exact: true })).toBeVisible({ timeout: 20_000 });
}

/** The numeric value shown on a Dashboard stat tile, found by its label text. */
export async function statTileValue(page: Page, label: string): Promise<number> {
  const card = page
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-card')][1]");
  const txt = await card.locator("span.text-3xl").innerText();
  return Number(txt.replace(/[^0-9-]/g, ""));
}

/** Fails the test if the browser logged any console error during the block. */
export function trackConsoleErrors(page: Page): { errors: string[] } {
  const state = { errors: [] as string[] };
  page.on("console", (msg) => {
    if (msg.type() === "error") state.errors.push(msg.text());
  });
  page.on("pageerror", (err) => state.errors.push(String(err)));
  return state;
}
