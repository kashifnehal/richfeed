import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const SEEDED_ERROR_MESSAGES = [
  "Your LinkedIn session expired before this post could publish",
  "The request to Instagram's API timed out",
  "TikTok rejected this video",
  "Facebook's API rate limit was reached",
  "YouTube couldn't process the uploaded video file",
];

test("failed post detail renders the publish attempt log in plain language", async ({ page }) => {
  await signIn(page);

  // Open a real failed target straight from the Dashboard attention list.
  const section = page.locator("section", { hasText: "Needs your attention" });
  await section.getByText("Post failed to publish").first().click();
  await page.waitForURL(/\/posts\/[0-9a-f-]+$/);

  const log = page.locator("details", { hasText: "Publish attempts" });
  await expect(log).toBeVisible();
  await log.locator("summary").click();

  const body = (await log.innerText()).replace(/\s+/g, " ");
  // At least one of the seeded, human-readable error strings shows up…
  expect(SEEDED_ERROR_MESSAGES.some((m) => body.includes(m))).toBe(true);
  // …and it is never a raw stack trace.
  expect(body).not.toMatch(/\bat .+\.(ts|js):\d+/);
  expect(body).not.toContain("node_modules");
});
