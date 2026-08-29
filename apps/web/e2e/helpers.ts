import { resolve } from "node:path";
import { expect, type APIResponse, type Page } from "@playwright/test";

export const CREDS = {
  email: process.env.E2E_USER_EMAIL!,
  password: process.env.E2E_USER_PASSWORD!,
};

/** Where auth.setup.ts stashes the signed-in session for the rest of the suite. */
export const STORAGE_STATE = resolve(__dirname, ".auth/user.json");

export const SIGNUP_CREDS = {
  email: process.env.E2E_SIGNUP_EMAIL!,
  password: process.env.E2E_SIGNUP_PASSWORD!,
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Signs in through the real form. In dev mode the sign-in page can be clicked
 * before React has hydrated — the browser then does a native GET form submit
 * (…/sign-in?email=…) and nothing happens — so this waits for hydration and
 * reloads/retries if a submit doesn't take.
 */
export async function formSignIn(page: Page, creds = CREDS): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto("/sign-in", { waitUntil: "load", timeout: 45_000 });
    // Give the client bundle time to hydrate the form's onSubmit handler.
    await page.waitForTimeout(1500);
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password").fill(creds.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    const bad = page
      .getByText(/invalid login credentials/i)
      .waitFor({ timeout: 15_000 })
      .then(() => "bad" as const)
      .catch(() => "pending" as const);
    const ok = page
      .waitForURL("**/dashboard", { timeout: 15_000 })
      .then(() => "ok" as const)
      .catch(() => "pending" as const);
    const outcome = await Promise.race([ok, bad]);

    if (outcome === "ok") {
      await expect(page.getByText("Published (7d)", { exact: true })).toBeVisible({ timeout: 45_000 });
      return;
    }
    if (outcome === "bad") throw new Error("sign-in rejected the credentials");
    // Native GET submit or a dropped click — loop and try again from a reload.
  }
  throw new Error("sign-in form never navigated to /dashboard");
}

/**
 * Lands on a signed-in Dashboard. The `chromium` project restores the session
 * saved by auth.setup.ts, so this is normally just a navigation; it falls back
 * to a real form sign-in if the stored session is missing/expired.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (new URL(page.url()).pathname.startsWith("/sign-in")) {
    await formSignIn(page);
    return;
  }
  await expect(page.getByText("Published (7d)", { exact: true })).toBeVisible({ timeout: 45_000 });
}

/** The numeric value shown on a Dashboard stat tile, found by its label text. */
export async function statTileValue(page: Page, label: string): Promise<number> {
  const card = page
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-card')][1]");
  const txt = await card.locator("span.text-3xl").innerText();
  return Number(txt.replace(/[^0-9-]/g, ""));
}

/**
 * Sniffs the Supabase access token off the Authorization header the app
 * attaches to its own API calls, so a test can hit the same API directly
 * (as a real round-trip oracle — never a mock). Call before signIn().
 */
export function captureBearer(page: Page): { token: string | null } {
  const ref: { token: string | null } = { token: null };
  page.on("request", (req) => {
    const auth = req.headers()["authorization"];
    if (auth?.startsWith("Bearer ")) ref.token = auth.slice("Bearer ".length);
  });
  return ref;
}

/** Direct authenticated call to apps/api — the same REST surface the app uses. */
export async function apiRequest(
  page: Page,
  token: string,
  path: string,
  init: { method?: string; data?: unknown } = {},
): Promise<APIResponse> {
  return page.request.fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(init.data !== undefined ? { data: init.data } : {}),
  });
}

/** apiRequest + assert 2xx + parse JSON. */
export async function apiJson<T = unknown>(
  page: Page,
  token: string,
  path: string,
  init?: { method?: string; data?: unknown },
): Promise<T> {
  const res = await apiRequest(page, token, path, init);
  if (!res.ok()) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status()} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export interface ApiTarget {
  id: string;
  scheduledPostId: string;
  status: string;
  publishAt: string;
  account: { id: string; displayName: string | null; platform: string } | null;
}
export interface ApiPost {
  id: string;
  caption: string | null;
  targets: ApiTarget[];
}

/** Every scheduled_post (with its targets) for the signed-in user, via the real API. */
export async function fetchPosts(page: Page, token: string): Promise<ApiPost[]> {
  const { posts } = await apiJson<{ posts: ApiPost[] }>(page, token, "/api/posts");
  return posts;
}

/** All post_targets for the signed-in user, flattened, via the real API. */
export async function fetchTargets(page: Page, token: string): Promise<ApiTarget[]> {
  return (await fetchPosts(page, token)).flatMap((p) => p.targets);
}

export async function fetchPost(page: Page, token: string, postId: string): Promise<ApiPost> {
  const { post } = await apiJson<{ post: ApiPost }>(page, token, `/api/posts/${postId}`);
  return post;
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
