import type { FastifyInstance } from "fastify";
import { requireUser, sendUnauthorized } from "../lib/auth";
import { deletePending, readPending, storePending } from "../lib/pending-store";

/**
 * Every OAuth /start route is reached by a real full-page browser
 * navigation (not a fetch — the provider's own consent screen has to
 * actually render), so it has no Authorization header to read and no
 * shared session cookie with the web app (different origin). A connect
 * ticket bridges that gap without putting the real access token in a URL/
 * request log: the Accounts page mints one here (a normal authenticated
 * fetch, so the usual Authorization-header check applies), then navigates
 * to /api/oauth/<platform>/start?ticket=<ticket>, which resolves it via
 * resolveConnectTicket below.
 */

const TICKET_PREFIX = "oauth_connect";
const TICKET_TTL_SECONDS = 60;

interface ConnectTicketPayload {
  userId: string;
}

export async function oauthConnectTicketRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/oauth/connect-ticket", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const ticket = await storePending<ConnectTicketPayload>(TICKET_PREFIX, { userId: user.id }, TICKET_TTL_SECONDS);
      return { ticket };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });
}

/** Resolves a connect ticket to the user id that minted it — single-use, deleted immediately on read. Returns null for a missing/expired/already-used ticket. */
export async function resolveConnectTicket(ticket: string | undefined): Promise<string | null> {
  if (!ticket) return null;

  const payload = await readPending<ConnectTicketPayload>(TICKET_PREFIX, ticket);
  if (!payload) return null;

  await deletePending(TICKET_PREFIX, ticket);
  return payload.userId;
}
