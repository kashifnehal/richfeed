import { expect, test } from "@playwright/test";
import { apiJson, captureBearer, signIn } from "./helpers";

interface AccountsResponse {
  accounts: { id: string; displayName: string | null; platform: string }[];
}

test("Accounts: the 3-dot 'Disconnect' actually removes the account", async ({ page }) => {
  const bearer = captureBearer(page);
  await signIn(page);
  const token = bearer.token!;

  const before = await apiJson<AccountsResponse>(page, token, "/api/accounts");
  const target = before.accounts.find((a) => a.displayName === "RichFeed Ideas");
  expect(target, "seeded Pinterest account present").toBeTruthy();

  await page.goto("/accounts");
  const card = page.locator("div.rounded-card").filter({ hasText: "RichFeed Ideas" });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Account actions" }).click();
  await page.getByRole("menuitem", { name: "Disconnect" }).click();

  const patch = page.waitForResponse(
    (r) => r.url().includes(`/api/accounts/${target!.id}`) && r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Disconnect" }).click();
  expect((await patch).status()).toBeLessThan(300);

  // Gone from the UI…
  await expect(page.locator("div.rounded-card").filter({ hasText: "RichFeed Ideas" })).toHaveCount(0);
  await expect(page.getByText(/^(Connected|Needs reconnect|Limited)$/)).toHaveCount(
    before.accounts.length - 1,
  );

  // …and gone from the server.
  const after = await apiJson<AccountsResponse>(page, token, "/api/accounts");
  expect(after.accounts).toHaveLength(before.accounts.length - 1);
  expect(after.accounts.some((a) => a.id === target!.id)).toBe(false);
});
