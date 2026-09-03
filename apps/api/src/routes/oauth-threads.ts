import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { encrypt } from "../lib/crypto";
import { requireEnv } from "../lib/env";
import { frontendOrigin } from "../lib/frontend-origin";
import { clearOAuthAttemptCookies, readOAuthAttemptCookies, setOAuthAttemptCookies } from "../lib/oauth-state";
import { upsertSocialAccount } from "../db/queries";
import { resolveConnectTicket } from "./oauth-connect-ticket";

// Threads is its own app/credentials, its own OAuth entirely — genuinely
// separate from both Facebook Login for Business and Instagram Login.
const AUTHORIZE_URL = "https://threads.net/oauth/authorize";
const TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const LONG_LIVED_URL = "https://graph.threads.net/access_token";
const IDENTITY_URL = "https://graph.threads.net/v1.0/me";
const SCOPE = "threads_basic,threads_content_publish";

function generateState(): string {
  return randomBytes(24).toString("base64url");
}

export async function oauthThreadsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/oauth/threads/start — see oauth-x.ts / oauth-connect-ticket.ts
  // for why this reads ?ticket instead of an Authorization header.
  app.get<{ Querystring: { ticket?: string } }>("/api/oauth/threads/start", async (request, reply) => {
    const userId = await resolveConnectTicket(request.query.ticket);
    if (!userId) {
      return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
    }

    let clientId: string;
    let redirectUri: string;
    try {
      clientId = requireEnv("THREADS_APP_ID");
      redirectUri = requireEnv("THREADS_REDIRECT_URI");
    } catch (err) {
      app.log.error(err, "[oauth-threads] missing env config for /start");
      return reply.redirect(`${frontendOrigin()}/accounts?error=threads_connect_failed`);
    }

    const state = generateState();
    setOAuthAttemptCookies(request, reply, "threads", { state, userId });

    const authorizeUrl =
      `${AUTHORIZE_URL}?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${SCOPE}&response_type=code` +
      `&state=${encodeURIComponent(state)}`;

    return reply.redirect(authorizeUrl);
  });

  // GET /api/oauth/threads/callback
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/oauth/threads/callback",
    async (request, reply) => {
      const { code, state, error: providerError } = request.query;
      const cookies = readOAuthAttemptCookies(request, "threads");
      clearOAuthAttemptCookies(request, reply, "threads");

      if (!cookies.state || !state || cookies.state !== state) {
        return reply.redirect(`${frontendOrigin()}/accounts?error=threads_state_mismatch`);
      }
      if (!cookies.userId) {
        return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
      }
      if (providerError || !code) {
        app.log.warn({ providerError }, "[oauth-threads] callback denied or missing code");
        return reply.redirect(`${frontendOrigin()}/accounts?error=threads_connect_failed`);
      }

      try {
        const clientId = requireEnv("THREADS_APP_ID");
        const clientSecret = requireEnv("THREADS_APP_SECRET");
        const redirectUri = requireEnv("THREADS_REDIRECT_URI");

        const tokenRes = await fetch(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
          }),
        });
        if (!tokenRes.ok) {
          throw new Error(`Threads token exchange failed with status ${tokenRes.status}`);
        }
        // Short-lived (1h) — exchanged for a long-lived token immediately below.
        const tokenBody = (await tokenRes.json()) as { access_token: string; user_id: string };

        const longLivedRes = await fetch(
          `${LONG_LIVED_URL}?grant_type=th_exchange_token&client_id=${encodeURIComponent(clientId)}` +
            `&client_secret=${encodeURIComponent(clientSecret)}&access_token=${encodeURIComponent(tokenBody.access_token)}`,
        );
        if (!longLivedRes.ok) {
          throw new Error(`Threads long-lived token exchange failed with status ${longLivedRes.status}`);
        }
        // expires_in ~60 days. No refresh job built yet — see platforms/threads.md.
        const longLivedBody = (await longLivedRes.json()) as { access_token: string; expires_in: number };

        const identityRes = await fetch(
          `${IDENTITY_URL}?fields=id,username&access_token=${encodeURIComponent(longLivedBody.access_token)}`,
        );
        if (!identityRes.ok) {
          throw new Error(`Threads identity lookup failed with status ${identityRes.status}`);
        }
        const identity = (await identityRes.json()) as { id: string; username: string };

        await upsertSocialAccount({
          userId: cookies.userId,
          platform: "threads",
          platformAccountId: identity.id,
          platformUsername: identity.username,
          displayName: identity.username,
          accessTokenEncrypted: encrypt(longLivedBody.access_token),
          tokenExpiresAt: new Date(Date.now() + longLivedBody.expires_in * 1000).toISOString(),
          scopes: SCOPE.split(","),
        });

        return reply.redirect(`${frontendOrigin()}/accounts?connected=threads`);
      } catch (err) {
        app.log.error(err, "[oauth-threads] callback failed");
        return reply.redirect(`${frontendOrigin()}/accounts?error=threads_connect_failed`);
      }
    },
  );
}
