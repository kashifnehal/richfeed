import type { FastifyReply, FastifyRequest } from "fastify";
import { getSupabaseClient } from "../db/supabase";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Verifies a raw Supabase access token and returns the user it belongs to,
 * or null if it's missing/invalid/expired. Shared by requireUser (reads the
 * Authorization header) and any route reached via a plain browser navigation
 * instead of a fetch — e.g. an OAuth `/start` route — which has no header to
 * read and must be handed the token another way.
 */
export async function getUserFromAccessToken(
  token: string,
): Promise<{ id: string; email: string | null } | null> {
  if (!token) return null;

  const { data, error } = await getSupabaseClient().auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Verifies the Supabase JWT on the Authorization header (`Bearer <token>`)
 * and returns the authenticated user. Every route that touches the
 * database MUST call this first — RLS is the real enforcement boundary,
 * but the API layer never even attempts a query without a verified session.
 *
 * Throws UnauthorizedError (caught by the route wrapper below) if the
 * header is missing/malformed or the token doesn't verify.
 */
export async function requireUser(
  request: FastifyRequest,
): Promise<{ id: string; email: string | null }> {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing bearer token");
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new UnauthorizedError("Missing bearer token");
  }

  const user = await getUserFromAccessToken(token);
  if (!user) {
    throw new UnauthorizedError("Invalid or expired session");
  }

  return user;
}

/** Sends a consistent 401 response for UnauthorizedError, rethrows anything else. */
export function sendUnauthorized(reply: FastifyReply, err: unknown): void {
  if (err instanceof UnauthorizedError) {
    reply.code(401).send({ error: err.message });
    return;
  }
  throw err;
}
