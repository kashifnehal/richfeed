import { test as setup } from "@playwright/test";
import { formSignIn, STORAGE_STATE } from "./helpers";

/**
 * Signs in once for the whole suite and saves the session (Supabase's
 * `sb-*-auth-token` cookies) to disk. The `chromium` project depends on this
 * and reuses the state, so the 20+ data/write-path tests don't each hammer
 * GoTrue's /token endpoint (which rate-limits). The auth specs opt out with
 * an empty storageState.
 */
setup("authenticate", async ({ page }) => {
  await formSignIn(page);
  await page.context().storageState({ path: STORAGE_STATE });
});
