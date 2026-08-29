import { expect, test } from "@playwright/test";
import {
  apiJson,
  captureBearer,
  fetchPost,
  fetchPosts,
  fetchTargets,
  signIn,
} from "./helpers";

test("Post detail: Cancel removes the scheduled target, reflected in the Queue", async ({
  page,
}) => {
  const bearer = captureBearer(page);
  await signIn(page);
  const token = bearer.token!;

  const posts = await fetchPosts(page, token);
  const victim = posts.find(
    (p) => p.targets.length === 1 && ["pending", "queued"].includes(p.targets[0]!.status),
  );
  expect(victim, "a single-target scheduled post to cancel").toBeTruthy();
  const targetId = victim!.targets[0]!.id;

  await page.goto(`/posts/${victim!.id}`);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  const patch = page.waitForResponse(
    (r) => r.url().includes(`/api/posts/${victim!.id}`) && r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Cancel post" }).click();
  expect((await patch).status()).toBeLessThan(300);

  // Server truth: the target is gone.
  const stillThere = (await fetchTargets(page, token)).some((t) => t.id === targetId);
  expect(stillThere).toBe(false);

  // And it's no longer in the Queue.
  await page.goto("/queue");
  await expect(page.locator("table")).toBeVisible();
  if (victim!.caption) {
    await expect(page.locator("table tbody tr", { hasText: victim!.caption })).toHaveCount(0);
  }
});

test("Post detail: 'Duplicate to another account' creates a real new target", async ({ page }) => {
  const bearer = captureBearer(page);
  await signIn(page);
  const token = bearer.token!;

  const { accounts } = await apiJson<{
    accounts: { id: string; displayName: string | null; status: string }[];
  }>(page, token, "/api/accounts");
  const posts = await fetchPosts(page, token);

  // A post with at least one target, plus a healthy account it doesn't target yet.
  let source!: (typeof posts)[number];
  let destName = "";
  for (const p of posts) {
    if (p.targets.length === 0) continue;
    const targeted = new Set(p.targets.map((t) => t.account?.id));
    const free = accounts.find((a) => a.status === "connected" && !targeted.has(a.id));
    if (free) {
      source = p;
      destName = free.displayName ?? "";
      break;
    }
  }
  expect(source, "a post to duplicate").toBeTruthy();

  await page.goto(`/posts/${source.id}`);
  await page.getByRole("button", { name: "Duplicate to another account" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.locator("label", { hasText: destName }).click();

  const dup = page.waitForResponse(
    (r) => r.url().includes(`/api/posts/${source.id}/duplicate`) && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Duplicate", exact: true }).click();
  const dupRes = await dup;
  expect(dupRes.status()).toBe(201);
  const { post: newPost } = await dupRes.json();

  await page.waitForURL(new RegExp(`/posts/${newPost.id}$`));

  const fromApi = await fetchPost(page, token, newPost.id);
  expect(fromApi.id).not.toBe(source.id);
  expect(fromApi.caption).toBe(source.caption);
  expect(fromApi.targets).toHaveLength(1);
  expect(fromApi.targets[0]!.account?.displayName).toBe(destName);
});

test("Post detail: 'Fix and reschedule' actually updates a seeded failed target", async ({
  page,
}) => {
  const bearer = captureBearer(page);
  await signIn(page);
  const token = bearer.token!;

  const failed = (await fetchTargets(page, token)).find((t) => t.status === "failed");
  expect(failed, "a seeded failed target").toBeTruthy();
  const before = failed!;

  await page.goto(`/posts/${before.scheduledPostId}`);
  // A failed post has a single target; its StatusPill is the only exact "Failed" text.
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Fix and reschedule" }).click();
  const dialog = page.getByRole("dialog");

  const when = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  when.setSeconds(0, 0);
  when.setMinutes(0);
  const pad = (n: number) => String(n).padStart(2, "0");
  await dialog
    .locator('input[type="datetime-local"]')
    .fill(
      `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`,
    );

  const patch = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/posts/${before.scheduledPostId}`) && r.request().method() === "PATCH",
  );
  await dialog.getByRole("button", { name: "Reschedule", exact: true }).click();
  expect((await patch).status()).toBeLessThan(300);

  const after = (await fetchPost(page, token, before.scheduledPostId)).targets.find(
    (t) => t.id === before.id,
  );
  expect(after, "the target still exists").toBeTruthy();
  expect(after!.status).toBe("pending");
  expect(new Date(after!.publishAt).getTime()).toBeGreaterThan(Date.now());
  expect(after!.publishAt).not.toBe(before.publishAt);

  // UI reflects it too — the pill flips Failed -> Scheduled.
  await expect(page.getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(page.getByText("Failed", { exact: true })).toHaveCount(0);
});
