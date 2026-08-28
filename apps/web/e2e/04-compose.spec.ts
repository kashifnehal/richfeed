import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/posts/new");
});

test("AccountMultiSelect lists connected accounts as selectable checkboxes", async ({ page }) => {
  const section = page.locator("section", { hasText: "Accounts" });
  const checkboxes = section.getByRole("checkbox");
  // All 9 seeded accounts are shown (connected + limited + needs_reconnect).
  await expect(checkboxes.first()).toBeVisible();
  expect(await checkboxes.count()).toBe(9);

  // A healthy account is selectable.
  const avery = page.locator("label", { hasText: "Avery Chen" }).getByRole("checkbox");
  await expect(avery).toBeEnabled();
  await avery.check();
  await expect(avery).toBeChecked();
});

test("needs_reconnect account appears but is disabled with an inline reason (doc 49 fix)", async ({
  page,
}) => {
  const jordanRow = page.locator("label", { hasText: "Jordan Ellis" });
  await expect(jordanRow).toBeVisible();
  await expect(jordanRow.getByRole("checkbox")).toBeDisabled();
  await expect(
    jordanRow.getByText(/reconnect to schedule posts here/i),
  ).toBeVisible();
});
