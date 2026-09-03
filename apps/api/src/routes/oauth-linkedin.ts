import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { encrypt } from "../lib/crypto";
import { requireEnv } from "../lib/env";
import { frontendOrigin } from "../lib/frontend-origin";
import { clearOAuthAttemptCookies, readOAuthAttemptCookies, setOAuthAttemptCookies } from "../lib/oauth-state";
import { upsertSocialAccount } from "../db/queries";
import { resolveConnectTicket } from "./oauth-connect-ticket";

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const IDENTITY_URL = "https://api.linkedin.com/v2/userinfo";
const SCOPE = "openid%20profile%20w_member_social";

function generateState(): string {
  return randomBytes(24).toString("base64url");
}

export async function oauthLinkedInRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/oauth/linkedin/start — see oauth-x.ts / oauth-connect-ticket.ts
  // for why this reads ?ticket instead of an Authorization header.
  app.get<{ Querystring: { ticket?: string } }>("/api/oauth/linkedin/start", async (request, reply) => {
    const userId = await resolveConnectTicket(request.query.ticket);
    if (!userId) {
      return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
    }

    let clientId: string;
    let redirectUri: string;
    try {
      clientId = requireEnv("LINKEDIN_CLIENT_ID");
      redirectUri = requireEnv("LINKEDIN_REDIRECT_URI");
    } catch (err) {
      app.log.error(err, "[oauth-linkedin] missing env config for /start");
      return reply.redirect(`${frontendOrigin()}/accounts?error=linkedin_connect_failed`);
    }

    const state = generateState();
    setOAuthAttemptCookies(request, reply, "linkedin", { state, userId });

    const authorizeUrl =
      `${AUTHORIZE_URL}?response_type=code&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${SCOPE}`;

    return reply.redirect(authorizeUrl);
  });

  // GET /api/oauth/linkedin/callback
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/oauth/linkedin/callback",
    async (request, reply) => {
      const { code, state, error: providerError } = request.query;
      const cookies = readOAuthAttemptCookies(request, "linkedin");
      clearOAuthAttemptCookies(request, reply, "linkedin");

      if (!cookies.state || !state || cookies.state !== state) {
        return reply.redirect(`${frontendOrigin()}/accounts?error=linkedin_state_mismatch`);
      }
      if (!cookies.userId) {
        return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
      }
      if (providerError || !code) {
        app.log.warn({ providerError }, "[oauth-linkedin] callback denied or missing code");
        return reply.redirect(`${frontendOrigin()}/accounts?error=linkedin_connect_failed`);
      }

      try {
        const clientId = requireEnv("LINKEDIN_CLIENT_ID");
        const clientSecret = requireEnv("LINKEDIN_CLIENT_SECRET");
        const redirectUri = requireEnv("LINKEDIN_REDIRECT_URI");

        const tokenRes = await fetch(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });
        if (!tokenRes.ok) {
          throw new Error(`LinkedIn token exchange failed with status ${tokenRes.status}`);
        }
        // LinkedIn's self-serve personal-profile OAuth doesn't reliably
        // return a refresh_token — treated as optional, not required.
        const tokenBody = (await tokenRes.json()) as {
          access_token: string;
          expires_in: number;
          refresh_token?: string;
        };

        const identityRes = await fetch(IDENTITY_URL, {
          headers: { Authorization: `Bearer ${tokenBody.access_token}` },
        });
        if (!identityRes.ok) {
          throw new Error(`LinkedIn identity lookup failed with status ${identityRes.status}`);
        }
        const identity = (await identityRes.json()) as { sub: string; name: string; picture?: string };

        await upsertSocialAccount({
          userId: cookies.userId,
          platform: "linkedin_personal",
          platformAccountId: identity.sub,
          displayName: identity.name,
          avatarUrl: identity.picture ?? null,
          accessTokenEncrypted: encrypt(tokenBody.access_token),
          refreshTokenEncrypted: tokenBody.refresh_token ? encrypt(tokenBody.refresh_token) : null,
          tokenExpiresAt: new Date(Date.now() + tokenBody.expires_in * 1000).toISOString(),
          scopes: ["openid", "profile", "w_member_social"],
        });

        return reply.redirect(`${frontendOrigin()}/accounts?connected=linkedin`);
      } catch (err) {
        app.log.error(err, "[oauth-linkedin] callback failed");
        return reply.redirect(`${frontendOrigin()}/accounts?error=linkedin_connect_failed`);
      }
    },
  );
}
