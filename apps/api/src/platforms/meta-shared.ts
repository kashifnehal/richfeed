import { PlatformPublishError } from "./types";
import { logPlatformApiError, readResponseBody } from "../lib/log-platform-error";

/**
 * Shared helpers for the Meta Graph API family (Facebook Pages, Instagram,
 * Threads) — unlike X's REST API, a Graph API auth failure often comes back
 * as HTTP 400 with `error.code === 190` / `error.type === "OAuthException"`
 * in the body, not a plain 401/403. Every Meta-family adapter should build
 * its thrown error through here rather than checking res.status alone.
 */

interface MetaErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

function isMetaAuthError(status: number, body: MetaErrorBody): boolean {
  return status === 401 || status === 403 || body.error?.code === 190 || body.error?.type === "OAuthException";
}

/** Builds (does not throw) the PlatformPublishError for a non-2xx Graph API response — `throw await buildMetaError(res)` at the call site. */
export async function buildMetaError(res: Response): Promise<PlatformPublishError> {
  const parsed = await readResponseBody(res);
  logPlatformApiError("meta", res.status, res.url, parsed);

  const body: MetaErrorBody =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as MetaErrorBody) : {};
  const message = body.error?.message ?? `Graph API error (${res.status})`;
  return new PlatformPublishError(message, isMetaAuthError(res.status, body), res.status);
}
