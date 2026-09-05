import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { encrypt } from "../lib/crypto";
import { requireEnv } from "../lib/env";
import { frontendOrigin } from "../lib/frontend-origin";
import {
  clearOAuthAttemptCookies,
  readOAuthAttemptCookies,
  setOAuthAttemptCookies,
} from "../lib/oauth-state";
import { upsertSocialAccount } from "../db/queries";
import { resolveConnectTicket } from "./oauth-connect-ticket";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHANNELS_URL =
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
const SCOPE =
  "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

function generateState(): string {
  return randomBytes(24).toString("base64url");
}

export async function oauthYouTubeRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/oauth/youtube/start — see oauth-x.ts / oauth-connect-ticket.ts
  // for why this reads ?ticket instead of an Authorization header.
  app.get<{ Querystring: { ticket?: string } }>(
    "/api/oauth/youtube/start",
    async (request, reply) => {
      const userId = await resolveConnectTicket(request.query.ticket);
      if (!userId) {
        return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
      }

      let clientId: string;
      let redirectUri: string;
      try {
        clientId = requireEnv("YOUTUBE_CLIENT_ID");
        redirectUri = requireEnv("YOUTUBE_REDIRECT_URI");
      } catch (err) {
        app.log.error(err, "[oauth-youtube] missing env config for /start");
        return reply.redirect(
          `${frontendOrigin()}/accounts?error=youtube_connect_failed`,
        );
      }

      const state = generateState();
      setOAuthAttemptCookies(request, reply, "youtube", { state, userId });

      // access_type=offline + prompt=consent are both required to reliably
      // get a refresh_token back — Google only issues one on first consent
      // otherwise.
      const authorizeUrl =
        `${AUTHORIZE_URL}?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(SCOPE)}` +
        `&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

      return reply.redirect(authorizeUrl);
    },
  );

  // GET /api/oauth/youtube/callback
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/oauth/youtube/callback",
    async (request, reply) => {
      const { code, state, error: providerError } = request.query;
      const cookies = readOAuthAttemptCookies(request, "youtube");
      clearOAuthAttemptCookies(request, reply, "youtube");

      if (!cookies.state || !state || cookies.state !== state) {
        return reply.redirect(
          `${frontendOrigin()}/accounts?error=youtube_state_mismatch`,
        );
      }
      if (!cookies.userId) {
        return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
      }
      if (providerError || !code) {
        app.log.warn(
          { providerError },
          "[oauth-youtube] callback denied or missing code",
        );
        return reply.redirect(
          `${frontendOrigin()}/accounts?error=youtube_connect_failed`,
        );
      }

      try {
        const clientId = requireEnv("YOUTUBE_CLIENT_ID");
        const clientSecret = requireEnv("YOUTUBE_CLIENT_SECRET");
        const redirectUri = requireEnv("YOUTUBE_REDIRECT_URI");

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
          throw new Error(
            `YouTube token exchange failed with status ${tokenRes.status}`,
          );
        }
        const tokenBody = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
        };
        if (!tokenBody.refresh_token) {
          // Shouldn't happen with access_type=offline&prompt=consent on a
          // first-time connect, but a reconnect without prompt=consent
          // re-triggering could still omit it — fail clearly rather than
          // storing an account that can never refresh.
          throw new Error(
            "Google did not return a refresh_token for this connection",
          );
        }

        // The channel id is the only usable platform_account_id here (no
        // separate lightweight identity endpoint the way other platforms
        // have one) — if youtube.upload doesn't permit this call at all,
        // there's nothing stable to upsert on, so this part is NOT
        // best-effort. The *display name/avatar* are best-effort on top of
        // a successful call — a placeholder if the snippet fields are
        // somehow missing, never a placeholder for the id itself.
        const channelRes = await fetch(CHANNELS_URL, {
          headers: { Authorization: `Bearer ${tokenBody.access_token}` },
        });
        if (!channelRes.ok) {
          throw new Error(
            `YouTube channel lookup failed with status ${channelRes.status}`,
          );
        }
        const channelBody = (await channelRes.json()) as {
          items?: {
            id: string;
            snippet: {
              title: string;
              thumbnails?: { default?: { url: string } };
            };
          }[];
        };
        const channel = channelBody.items?.[0];
        if (!channel) {
          throw new Error(
            "YouTube channel lookup returned no channels for this account",
          );
        }

        await upsertSocialAccount({
          userId: cookies.userId,
          platform: "youtube",
          platformAccountId: channel.id,
          displayName: channel.snippet.title || "YouTube channel",
          avatarUrl: channel.snippet.thumbnails?.default?.url ?? null,
          accessTokenEncrypted: encrypt(tokenBody.access_token),
          refreshTokenEncrypted: encrypt(tokenBody.refresh_token),
          tokenExpiresAt: new Date(
            Date.now() + tokenBody.expires_in * 1000,
          ).toISOString(),
          scopes: SCOPE.split(" "),
        });

        return reply.redirect(`${frontendOrigin()}/accounts?connected=youtube`);
      } catch (err) {
        app.log.error(err, "[oauth-youtube] callback failed");
        return reply.redirect(
          `${frontendOrigin()}/accounts?error=youtube_connect_failed`,
        );
      }
    },
  );
}
