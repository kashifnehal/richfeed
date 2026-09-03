import type { MediaType } from "@richfeed/shared";

/**
 * Shared adapter contract for apps/api/src/platforms/*.ts. Every platform
 * adapter exports an async `publishTo<Platform>(account, target, post)` that
 * follows this shape, so worker.ts can dispatch by platform without knowing
 * each adapter's internals, and every future platform integration reuses it.
 */

export interface PublishAccount {
  id: string;
  platformAccountId: string;
  platformUsername: string | null;
  /** Encrypted (crypto.ts) — adapters decrypt() before use. */
  accessToken: string;
  /** Encrypted (crypto.ts), null if the platform never issued one. */
  refreshToken: string | null;
  tokenExpiresAt: string | null;
}

export interface PublishTarget {
  id: string;
  platformCaptionOverride: string | null;
}

export interface PublishPost {
  caption: string | null;
  mediaUrls: string[] | null;
  mediaType: MediaType | null;
}

export interface PublishResult {
  platformPostId: string;
  /** Real permalink URL when the adapter can get one at publish time — undefined leaves it unset (never guessed client-side; see migration 0005). */
  permalinkUrl?: string;
}

/**
 * Thrown by an adapter on any non-2xx response. `isAuthFailure` lets
 * worker.ts distinguish "reconnect needed" (401/403, or an unrefreshable
 * token) from an ordinary failed publish attempt.
 */
export class PlatformPublishError extends Error {
  constructor(
    message: string,
    public readonly isAuthFailure: boolean,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "PlatformPublishError";
  }
}
