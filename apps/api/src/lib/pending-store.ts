import { randomBytes } from "node:crypto";
import { getRedisConnection } from "../queue/connection";

/**
 * Short-lived (default 10 min) Redis-backed key/value store for state that
 * has to survive a round trip through a frontend UI screen — bigger than an
 * OAuth-attempt cookie can reasonably hold (see lib/oauth-state.ts for that
 * simpler case) and gone once the flow finishes or the TTL lapses. First use:
 * Facebook's "which Pages do you want to connect?" picker (oauth-facebook.ts)
 * between the OAuth callback and the confirm step. Redis (already wired for
 * BullMQ) rather than an in-process Map so `tsx watch`'s dev-mode restarts
 * don't silently drop a pending connection mid-flow.
 */

const DEFAULT_TTL_SECONDS = 600;

function key(prefix: string, id: string): string {
  return `pending:${prefix}:${id}`;
}

/** Stores `payload` and returns the random id to look it up by. */
export async function storePending<T>(
  prefix: string,
  payload: T,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const id = randomBytes(16).toString("hex");
  await getRedisConnection().set(key(prefix, id), JSON.stringify(payload), "EX", ttlSeconds);
  return id;
}

/** Reads back a pending payload, or null if it's missing/expired. */
export async function readPending<T>(prefix: string, id: string): Promise<T | null> {
  const raw = await getRedisConnection().get(key(prefix, id));
  return raw ? (JSON.parse(raw) as T) : null;
}

/** Deletes a pending payload once the flow that created it is done with it. */
export async function deletePending(prefix: string, id: string): Promise<void> {
  await getRedisConnection().del(key(prefix, id));
}
