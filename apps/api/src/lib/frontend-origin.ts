import { requireEnv } from "./env";

/**
 * The web app's own origin — used to build every OAuth redirect target
 * (success/error/sign-in bounces). Deliberately its own env var rather than
 * NEXT_PUBLIC_APP_URL: that one is already set in this environment to a
 * future production domain unrelated to local dev (see git history/
 * platforms/x.md), and reading it directly silently sent every OAuth
 * redirect off of localhost. FRONTEND_ORIGIN is explicit about what it's
 * for. Read lazily (call-time, not import-time) like every other env-backed
 * helper in this codebase.
 */
export function frontendOrigin(): string {
  return requireEnv("FRONTEND_ORIGIN");
}
