import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const rows = (page: Page) => page.locator("table tbody tr");

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("first page requests only 20 rows server-side; Load more fetches the rest", async ({ page }) => {
  const firstPage = page.waitForResponse(
    (r) => r.url().includes("/api/posts?") && r.url().includes("offset=0"),
  );
  await page.goto("/queue");
  const res = await firstPage;
  const body = await res.json();

  // The API paged this server-side: a pagination block, and no more than 20 target rows.
  expect(body.pagination).toMatchObject({ limit: 20, offset: 0, total: 26, hasMore: true });
  const targetRows = body.posts.reduce(
    (n: number, p: { targets: unknown[] }) => n + p.targets.length,
    0,
  );
  expect(targetRows).toBe(20);

  await expect(rows(page)).toHaveCount(20);

  const loadMore = page.getByRole("button", { name: /Load more \(6 remaining\)/ });
  await expect(loadMore).toBeVisible();

  const secondPage = page.waitForResponse(
    (r) => r.url().includes("/api/posts?") && r.url().includes("offset=20"),
  );
  await loadMore.click();
  const res2 = await secondPage;
  const body2 = await res2.json();
  const targetRows2 = body2.posts.reduce(
    (n: number, p: { targets: unknown[] }) => n + p.targets.length,
    0,
  );
  expect(targetRows2).toBe(6);
  expect(body2.pagination.hasMore).toBe(false);

  await expect(rows(page)).toHaveCount(26);
  await expect(page.getByRole("button", { name: /Load more/ })).toHaveCount(0);
});

test("the sortable 'Scheduled' header re-sorts the visible rows", async ({ page }) => {
  await page.goto("/queue");
  await expect(rows(page)).toHaveCount(20);

  const scheduledColumn = async (): Promise<number[]> => {
    const cells = await rows(page).locator("td:nth-child(3)").allInnerTexts();
    return cells.map((t) => new Date(t).getTime());
  };

  const asc = await scheduledColumn();
  expect(asc).toEqual([...asc].sort((a, b) => a - b));
  const firstCaptionAsc = await rows(page).first().locator("td").first().innerText();

  const sortReq = page.waitForResponse(
    (r) => r.url().includes("/api/posts?") && r.url().includes("sort=desc"),
  );
  await page.getByRole("button", { name: "Scheduled" }).click();
  await sortReq;
  await expect(rows(page)).toHaveCount(20);

  const desc = await scheduledColumn();
  expect(desc).toEqual([...desc].sort((a, b) => b - a));
  const firstCaptionDesc = await rows(page).first().locator("td").first().innerText();
  expect(firstCaptionDesc).not.toBe(firstCaptionAsc);
});
