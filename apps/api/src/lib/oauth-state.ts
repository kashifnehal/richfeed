import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Short-lived httpOnly cookies that carry a platform OAuth attempt (PKCE
 * verifier + CSRF state + the initiating user's id) across the redirect
 * round-trip to the provider and back. No cookie plugin is registered on
 * this app — these are hand-rolled Set-Cookie headers, which is all three
 * short-lived values need. Every future platform OAuth route should reuse
 * this instead of rolling its own.
 */

const COOKIE_MAX_AGE_SECONDS = 600; // 10 minutes

function isLocalhostRequest(request: FastifyRequest): boolean {
  const host = request.hostname ?? "";
  return host === "localhost" || host === "127.0.0.1";
}

function cookieString(name: string, value: string, secure: boolean, maxAgeSeconds: number): string {
  const parts = [`${name}=${value}`, `Max-Age=${maxAgeSeconds}`, "Path=/api/oauth", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export interface OAuthAttemptCookies {
  state: string;
  verifier: string;
  userId: string;
}

/** Sets the state/verifier/userId cookies for a new OAuth attempt on `platform`. */
export function setOAuthAttemptCookies(
  request: FastifyRequest,
  reply: FastifyReply,
  platform: string,
  values: OAuthAttemptCookies,
): void {
  const secure = !isLocalhostRequest(request);
  reply.header("set-cookie", [
    cookieString(`${platform}_oauth_state`, values.state, secure, COOKIE_MAX_AGE_SECONDS),
    cookieString(`${platform}_oauth_verifier`, values.verifier, secure, COOKIE_MAX_AGE_SECONDS),
    cookieString(`${platform}_oauth_user`, values.userId, secure, COOKIE_MAX_AGE_SECONDS),
  ]);
}

/** Reads back whatever OAuth attempt cookies are present for `platform`. Missing pieces come back undefined. */
export function readOAuthAttemptCookies(
  request: FastifyRequest,
  platform: string,
): Partial<OAuthAttemptCookies> {
  const header = request.headers.cookie ?? "";
  const jar = new Map<string, string>();
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  return {
    state: jar.get(`${platform}_oauth_state`),
    verifier: jar.get(`${platform}_oauth_verifier`),
    userId: jar.get(`${platform}_oauth_user`),
  };
}

/** Clears the OAuth attempt cookies for `platform` once the flow is done with them (success or failure). */
export function clearOAuthAttemptCookies(request: FastifyRequest, reply: FastifyReply, platform: string): void {
  const secure = !isLocalhostRequest(request);
  reply.header("set-cookie", [
    cookieString(`${platform}_oauth_state`, "", secure, 0),
    cookieString(`${platform}_oauth_verifier`, "", secure, 0),
    cookieString(`${platform}_oauth_user`, "", secure, 0),
  ]);
}
