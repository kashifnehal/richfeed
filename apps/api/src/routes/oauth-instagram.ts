import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { encrypt } from "../lib/crypto";
import { requireEnv } from "../lib/env";
import { frontendOrigin } from "../lib/frontend-origin";
import { clearOAuthAttemptCookies, readOAuthAttemptCookies, setOAuthAttemptCookies } from "../lib/oauth-state";
import { upsertSocialAccount } from "../db/queries";
import { resolveConnectTicket } from "./oauth-connect-ticket";

// "Instagram API with Instagram Login" — its own standalone product with
// its own App ID/OAuth flow, genuinely separate from Facebook Login for
// Business (routes/oauth-facebook.ts). Do not merge these.
const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const LONG_LIVED_URL = "https://graph.instagram.com/access_token";
const IDENTITY_URL = "https://graph.instagram.com/v21.0/me";
const SCOPE = "instagram_business_basic,instagram_business_content_publish";

function generateState(): string {
  return randomBytes(24).toString("base64url");
}

export async function oauthInstagramRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/oauth/instagram/start — see oauth-x.ts / oauth-connect-ticket.ts
  // for why this reads ?ticket instead of an Authorization header.
  app.get<{ Querystring: { ticket?: string } }>("/api/oauth/instagram/start", async (request, reply) => {
    const userId = await resolveConnectTicket(request.query.ticket);
    if (!userId) {
      return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
    }

    let clientId: string;
    let redirectUri: string;
    try {
      clientId = requireEnv("INSTAGRAM_APP_ID");
      redirectUri = requireEnv("INSTAGRAM_REDIRECT_URI");
    } catch (err) {
      app.log.error(err, "[oauth-instagram] missing env config for /start");
      return reply.redirect(`${frontendOrigin()}/accounts?error=instagram_connect_failed`);
    }

    const state = generateState();
    setOAuthAttemptCookies(request, reply, "instagram", { state, userId });

    const authorizeUrl =
      `${AUTHORIZE_URL}?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${SCOPE}` +
      `&state=${encodeURIComponent(state)}`;

    return reply.redirect(authorizeUrl);
  });

  // GET /api/oauth/instagram/callback
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/oauth/instagram/callback",
    async (request, reply) => {
      const { code, state, error: providerError } = request.query;
      const cookies = readOAuthAttemptCookies(request, "instagram");
      clearOAuthAttemptCookies(request, reply, "instagram");

      if (!cookies.state || !state || cookies.state !== state) {
        return reply.redirect(`${frontendOrigin()}/accounts?error=instagram_state_mismatch`);
      }
      if (!cookies.userId) {
        return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
      }
      if (providerError || !code) {
        app.log.warn({ providerError }, "[oauth-instagram] callback denied or missing code");
        return reply.redirect(`${frontendOrigin()}/accounts?error=instagram_connect_failed`);
      }

      try {
        const clientId = requireEnv("INSTAGRAM_APP_ID");
        const clientSecret = requireEnv("INSTAGRAM_APP_SECRET");
        const redirectUri = requireEnv("INSTAGRAM_REDIRECT_URI");

        // Instagram's token-exchange endpoint expects multipart/form-data,
        // not the application/x-www-form-urlencoded most OAuth token
        // endpoints use (X's included) — verified against Meta's current
        // "Instagram API with Instagram Login" docs at implementation time.
        const form = new FormData();
        form.append("client_id", clientId);
        form.append("client_secret", clientSecret);
        form.append("grant_type", "authorization_code");
        form.append("redirect_uri", redirectUri);
        form.append("code", code);

        const tokenRes = await fetch(TOKEN_URL, { method: "POST", body: form });
        if (!tokenRes.ok) {
          throw new Error(`Instagram token exchange failed with status ${tokenRes.status}`);
        }
        const tokenBody = (await tokenRes.json()) as { access_token: string; user_id: string };

        const longLivedRes = await fetch(
          `${LONG_LIVED_URL}?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(clientSecret)}` +
            `&access_token=${encodeURIComponent(tokenBody.access_token)}`,
        );
        if (!longLivedRes.ok) {
          throw new Error(`Instagram long-lived token exchange failed with status ${longLivedRes.status}`);
        }
        const longLivedBody = (await longLivedRes.json()) as { access_token: string; expires_in: number };

        const identityRes = await fetch(
          `${IDENTITY_URL}?fields=id,username,account_type&access_token=${encodeURIComponent(longLivedBody.access_token)}`,
        );
        if (!identityRes.ok) {
          throw new Error(`Instagram identity lookup failed with status ${identityRes.status}`);
        }
        const identity = (await identityRes.json()) as { id: string; username: string; account_type: string };

        // A Personal account can authenticate but can never publish through
        // this API — reject clearly at connect time instead of storing a
        // row that would only fail later, silently, at publish time.
        if (identity.account_type !== "BUSINESS" && identity.account_type !== "CREATOR") {
          app.log.warn(
            { accountType: identity.account_type },
            "[oauth-instagram] rejected a non-Business/Creator account",
          );
          return reply.redirect(`${frontendOrigin()}/accounts?error=instagram_personal_account`);
        }

        await upsertSocialAccount({
          userId: cookies.userId,
          platform: "instagram",
          platformAccountId: identity.id,
          platformUsername: identity.username,
          displayName: identity.username,
          accessTokenEncrypted: encrypt(longLivedBody.access_token),
          tokenExpiresAt: new Date(Date.now() + longLivedBody.expires_in * 1000).toISOString(),
          scopes: SCOPE.split(","),
        });

        return reply.redirect(`${frontendOrigin()}/accounts?connected=instagram`);
      } catch (err) {
        app.log.error(err, "[oauth-instagram] callback failed");
        return reply.redirect(`${frontendOrigin()}/accounts?error=instagram_connect_failed`);
      }
    },
  );
}
