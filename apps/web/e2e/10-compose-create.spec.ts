import { expect, test } from "@playwright/test";
import { captureBearer, fetchPost, signIn } from "./helpers";

test("Compose: full create flow round-trips through POST /api/posts into the Queue", async ({
  page,
}) => {
  const bearer = captureBearer(page);
  await signIn(page);
  const token = bearer.token!;
  expect(token, "captured a Supabase bearer token").toBeTruthy();

  const marker = `E2E create ${Date.now()}`;

  await page.goto("/posts/new");
  await page.getByPlaceholder("Write your post...").fill(marker);

  const hashtagInput = page.getByPlaceholder("Add a hashtag...");
  await hashtagInput.fill("smoketest");
  await hashtagInput.press("Enter");
  await hashtagInput.fill("playwright");
  await hashtagInput.press("Enter");
  await expect(page.getByText("#smoketest")).toBeVisible();

  // One real connected account.
  await page.locator("label", { hasText: "Avery Chen" }).getByRole("checkbox").check();

  // A real future publish time (5 days out, on the :00), set on the target row.
  const when = new Date(Date.now() + 5 * 24 * 3600 * 1000);
  when.setSeconds(0, 0);
  when.setMinutes(0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const localValue = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
  await page.locator('input[type="datetime-local"]').fill(localValue);

  const postResp = page.waitForResponse(
    (r) => r.url().endsWith("/api/posts") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save to queue" }).click();
  const created = await postResp;
  expect(created.status()).toBe(201);
  const { post } = await created.json();
  expect(post.caption).toBe(marker);

  // App navigates to the new post's detail page.
  await page.waitForURL(new RegExp(`/posts/${post.id}$`));

  // Server truth: the post has exactly one target, for Avery's account, scheduled.
  const fromApi = await fetchPost(page, token, post.id);
  expect(fromApi.targets).toHaveLength(1);
  expect(fromApi.targets[0]!.account?.displayName).toBe("Avery Chen");
  expect(["pending", "queued"]).toContain(fromApi.targets[0]!.status);
  expect(new Date(fromApi.targets[0]!.publishAt).getTime()).toBeGreaterThan(Date.now());

  // And it actually shows up in the Queue. Sort newest-scheduled-first (the new
  // post is 5 days out), then page through until the row is on screen.
  await page.goto("/queue");
  await page.getByRole("button", { name: "Scheduled" }).click();
  const row = page.locator("table tbody tr", { hasText: marker });
  for (let i = 0; i < 4 && (await row.count()) === 0; i++) {
    const more = page.getByRole("button", { name: /Load more/ });
    if ((await more.count()) === 0) break;
    await more.click();
    await page.waitForTimeout(500);
  }
  await expect(row).toHaveCount(1);
});

test("Compose: 'Save to queue' with no account selected is blocked (same real save path)", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/posts/new");
  await page.getByPlaceholder("Write your post...").fill(`E2E validation ${Date.now()}`);

  let postFired = false;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/posts") && r.method() === "POST") postFired = true;
  });

  await page.getByRole("button", { name: "Save to queue" }).click();
  await expect(page.getByText("Select at least one account")).toBeVisible();
  await expect(page).toHaveURL(/\/posts\/new$/);
  expect(postFired).toBe(false);
});
