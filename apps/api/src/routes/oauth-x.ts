import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { getUserFromAccessToken } from "../lib/auth";
import { encrypt } from "../lib/crypto";
import { requireEnv } from "../lib/env";
import { clearOAuthAttemptCookies, readOAuthAttemptCookies, setOAuthAttemptCookies } from "../lib/oauth-state";
import { upsertSocialAccount } from "../db/queries";

const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_USERS_ME_URL = "https://api.x.com/2/users/me?user.fields=profile_image_url";
const X_SCOPE = "tweet.write%20tweet.read%20users.read%20media.write%20offline.access";

// Deliberately NOT process.env.NEXT_PUBLIC_APP_URL — that's already set in
// this environment's .env to a future production domain (richfeed.social)
// unrelated to local dev, and this app has no deployment yet (see CLAUDE.md).
// Matches the CORS origin already hardcoded the same way in server.ts.
function frontendOrigin(): string {
  return "http://localhost:3000";
}

function generateVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function challengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return randomBytes(24).toString("base64url");
}

export async function oauthXRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/oauth/x/start — begins the Authorization Code + PKCE flow.
  //
  // Reached via a real full-page browser navigation from the Accounts page
  // (not a fetch — the browser has to actually land on X's consent screen),
  // so there's no Authorization header here, and no way to read the web
  // app's Supabase session cookie either — that cookie is scoped to the web
  // app's own origin (localhost:3000), not this API's (localhost:4000).
  // The caller reads its own session client-side and passes the access
  // token as ?access_token; this route verifies it once and carries the
  // resulting user id through the PKCE cookie round-trip (see
  // lib/oauth-state.ts) so /callback knows whose account to attach without
  // needing a live session of its own.
  app.get<{ Querystring: { access_token?: string } }>("/api/oauth/x/start", async (request, reply) => {
    const token = request.query.access_token;
    const user = token ? await getUserFromAccessToken(token) : null;
    if (!user) {
      return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
    }

    let clientId: string;
    let redirectUri: string;
    try {
      clientId = requireEnv("X_CLIENT_ID");
      redirectUri = requireEnv("X_REDIRECT_URI");
    } catch (err) {
      app.log.error(err, "[oauth-x] missing env config for /start");
      return reply.redirect(`${frontendOrigin()}/accounts?error=x_connect_failed`);
    }

    const verifier = generateVerifier();
    const challenge = challengeFromVerifier(verifier);
    const state = generateState();

    setOAuthAttemptCookies(request, reply, "x", { state, verifier, userId: user.id });

    const authorizeUrl =
      `${X_AUTHORIZE_URL}?response_type=code&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${X_SCOPE}` +
      `&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;

    return reply.redirect(authorizeUrl);
  });

  // GET /api/oauth/x/callback — X lands the browser back here after consent.
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/oauth/x/callback",
    async (request, reply) => {
      const { code, state, error: providerError } = request.query;
      const cookies = readOAuthAttemptCookies(request, "x");
      clearOAuthAttemptCookies(request, reply, "x");

      if (!cookies.state || !state || cookies.state !== state) {
        return reply.redirect(`${frontendOrigin()}/accounts?error=x_state_mismatch`);
      }
      if (!cookies.userId) {
        return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
      }
      if (providerError || !code || !cookies.verifier) {
        app.log.warn({ providerError }, "[oauth-x] callback denied or missing code");
        return reply.redirect(`${frontendOrigin()}/accounts?error=x_connect_failed`);
      }

      try {
        const clientId = requireEnv("X_CLIENT_ID");
        const clientSecret = requireEnv("X_CLIENT_SECRET");
        const redirectUri = requireEnv("X_REDIRECT_URI");
        const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

        const tokenRes = await fetch(X_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${basic}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            code_verifier: cookies.verifier,
            client_id: clientId,
          }),
        });

        if (!tokenRes.ok) {
          throw new Error(`X token exchange failed with status ${tokenRes.status}`);
        }

        const tokenBody = (await tokenRes.json()) as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
        };

        const identityRes = await fetch(X_USERS_ME_URL, {
          headers: { Authorization: `Bearer ${tokenBody.access_token}` },
        });

        if (!identityRes.ok) {
          throw new Error(`X identity lookup failed with status ${identityRes.status}`);
        }

        const identityBody = (await identityRes.json()) as {
          data: { id: string; username: string; name: string };
        };

        await upsertSocialAccount({
          userId: cookies.userId,
          platform: "twitter",
          platformAccountId: identityBody.data.id,
          platformUsername: identityBody.data.username,
          displayName: identityBody.data.name || identityBody.data.username,
          accessTokenEncrypted: encrypt(tokenBody.access_token),
          refreshTokenEncrypted: encrypt(tokenBody.refresh_token),
          tokenExpiresAt: new Date(Date.now() + tokenBody.expires_in * 1000).toISOString(),
          scopes: ["tweet.write", "tweet.read", "users.read", "media.write", "offline.access"],
        });

        return reply.redirect(`${frontendOrigin()}/accounts?connected=x`);
      } catch (err) {
        // Never leak the raw provider error body into the redirect URL or the client.
        app.log.error(err, "[oauth-x] callback failed");
        return reply.redirect(`${frontendOrigin()}/accounts?error=x_connect_failed`);
      }
    },
  );
}
