import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireUser, getUserFromAccessToken, sendUnauthorized } from "../lib/auth";
import { encrypt } from "../lib/crypto";
import { requireEnv } from "../lib/env";
import { clearOAuthAttemptCookies, readOAuthAttemptCookies, setOAuthAttemptCookies } from "../lib/oauth-state";
import { deletePending, readPending, storePending } from "../lib/pending-store";
import { upsertSocialAccount } from "../db/queries";

const GRAPH_VERSION = "v26.0";
const AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const ACCOUNTS_URL = `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`;
const SCOPE = "pages_show_list,pages_read_engagement,pages_manage_posts,business_management";
const PENDING_PREFIX = "facebook_pages";

// Deliberately NOT process.env.NEXT_PUBLIC_APP_URL — see oauth-x.ts.
function frontendOrigin(): string {
  return "http://localhost:3000";
}

function generateState(): string {
  return randomBytes(24).toString("base64url");
}

interface PendingPage {
  id: string;
  name: string;
  /** Encrypted (crypto.ts) Page access token — never sent to the client, only used server-side on confirm. */
  accessTokenEncrypted: string;
}

interface PendingFacebookConnection {
  userId: string;
  pages: PendingPage[];
}

export async function oauthFacebookRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/oauth/facebook/start — see oauth-x.ts for why this reads
  // ?access_token instead of an Authorization header.
  app.get<{ Querystring: { access_token?: string } }>("/api/oauth/facebook/start", async (request, reply) => {
    const token = request.query.access_token;
    const user = token ? await getUserFromAccessToken(token) : null;
    if (!user) {
      return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
    }

    let clientId: string;
    let redirectUri: string;
    try {
      clientId = requireEnv("META_APP_ID");
      redirectUri = requireEnv("META_REDIRECT_URI");
    } catch (err) {
      app.log.error(err, "[oauth-facebook] missing env config for /start");
      return reply.redirect(`${frontendOrigin()}/accounts?error=facebook_connect_failed`);
    }

    const state = generateState();
    setOAuthAttemptCookies(request, reply, "facebook", { state, userId: user.id });

    const authorizeUrl =
      `${AUTHORIZE_URL}?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${SCOPE}&state=${encodeURIComponent(state)}`;

    return reply.redirect(authorizeUrl);
  });

  // GET /api/oauth/facebook/callback — unlike every other platform here,
  // Facebook can return several connectable Pages from one grant. Rather
  // than upserting immediately, the Page list is stashed server-side
  // (lib/pending-store.ts) and the browser is handed off to a frontend
  // picker screen instead of straight back to /accounts.
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/oauth/facebook/callback",
    async (request, reply) => {
      const { code, state, error: providerError } = request.query;
      const cookies = readOAuthAttemptCookies(request, "facebook");
      clearOAuthAttemptCookies(request, reply, "facebook");

      if (!cookies.state || !state || cookies.state !== state) {
        return reply.redirect(`${frontendOrigin()}/accounts?error=facebook_state_mismatch`);
      }
      if (!cookies.userId) {
        return reply.redirect(`${frontendOrigin()}/sign-in?returnTo=/accounts`);
      }
      if (providerError || !code) {
        app.log.warn({ providerError }, "[oauth-facebook] callback denied or missing code");
        return reply.redirect(`${frontendOrigin()}/accounts?error=facebook_connect_failed`);
      }

      try {
        const clientId = requireEnv("META_APP_ID");
        const clientSecret = requireEnv("META_APP_SECRET");
        const redirectUri = requireEnv("META_REDIRECT_URI");

        // Meta's exchange is a GET with query params, not a POST body.
        const tokenRes = await fetch(
          `${TOKEN_URL}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`,
        );
        if (!tokenRes.ok) {
          throw new Error(`Facebook token exchange failed with status ${tokenRes.status}`);
        }
        const tokenBody = (await tokenRes.json()) as { access_token: string };

        const longLivedRes = await fetch(
          `${TOKEN_URL}?grant_type=fb_exchange_token&client_id=${encodeURIComponent(clientId)}` +
            `&client_secret=${encodeURIComponent(clientSecret)}&fb_exchange_token=${encodeURIComponent(tokenBody.access_token)}`,
        );
        if (!longLivedRes.ok) {
          throw new Error(`Facebook long-lived token exchange failed with status ${longLivedRes.status}`);
        }
        const longLivedBody = (await longLivedRes.json()) as { access_token: string };

        const accountsRes = await fetch(
          `${ACCOUNTS_URL}?access_token=${encodeURIComponent(longLivedBody.access_token)}`,
        );
        if (!accountsRes.ok) {
          throw new Error(`Facebook /me/accounts failed with status ${accountsRes.status}`);
        }
        const accountsBody = (await accountsRes.json()) as {
          data: { id: string; name: string; access_token: string }[];
        };

        if (accountsBody.data.length === 0) {
          return reply.redirect(`${frontendOrigin()}/accounts?error=facebook_no_pages`);
        }

        const pending: PendingFacebookConnection = {
          userId: cookies.userId,
          pages: accountsBody.data.map((p) => ({
            id: p.id,
            name: p.name,
            accessTokenEncrypted: encrypt(p.access_token),
          })),
        };
        const pendingId = await storePending(PENDING_PREFIX, pending);

        return reply.redirect(`${frontendOrigin()}/accounts/connect/facebook?pending=${pendingId}`);
      } catch (err) {
        app.log.error(err, "[oauth-facebook] callback failed");
        return reply.redirect(`${frontendOrigin()}/accounts?error=facebook_connect_failed`);
      }
    },
  );

  // GET /api/oauth/facebook/pending/:id — reached by a normal authenticated
  // fetch from the picker page (not a top-level nav), so this goes through
  // the usual Authorization-header path like every other route. Never
  // returns the encrypted Page tokens to the client.
  app.get<{ Params: { id: string } }>("/api/oauth/facebook/pending/:id", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const pending = await readPending<PendingFacebookConnection>(PENDING_PREFIX, request.params.id);

      if (!pending || pending.userId !== user.id) {
        return reply.code(404).send({ error: "This connection attempt expired. Please reconnect." });
      }

      return { pages: pending.pages.map((p) => ({ id: p.id, name: p.name })) };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });

  // POST /api/oauth/facebook/confirm — writes only the Pages the user
  // actually checked.
  app.post<{ Body: { pendingId?: string; selectedPageIds?: string[] } }>(
    "/api/oauth/facebook/confirm",
    async (request, reply) => {
      try {
        const user = await requireUser(request);
        const { pendingId, selectedPageIds } = request.body ?? {};

        if (!pendingId || !Array.isArray(selectedPageIds) || selectedPageIds.length === 0) {
          return reply.code(400).send({ error: "Select at least one Page to connect" });
        }

        const pending = await readPending<PendingFacebookConnection>(PENDING_PREFIX, pendingId);
        if (!pending || pending.userId !== user.id) {
          return reply.code(404).send({ error: "This connection attempt expired. Please reconnect." });
        }

        const selected = pending.pages.filter((p) => selectedPageIds.includes(p.id));

        for (const page of selected) {
          await upsertSocialAccount({
            userId: user.id,
            platform: "facebook",
            platformAccountId: page.id,
            displayName: page.name,
            accessTokenEncrypted: page.accessTokenEncrypted,
            scopes: SCOPE.split(","),
          });
        }

        await deletePending(PENDING_PREFIX, pendingId);

        return { ok: true, connected: selected.length };
      } catch (err) {
        sendUnauthorized(reply, err);
      }
    },
  );
}
