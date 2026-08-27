/**
 * Shared domain types for The Social Queue.
 * Types only — no runtime logic, no DB connection in this step.
 */

/** A social platform an account can be connected to / a post can target. */
export type Platform =
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin_personal"
  | "linkedin_org"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "threads"
  | "reddit";

/** Publishing status of a single post target (one post -> many targets). */
export type PostTargetStatus =
  | "pending"
  | "publishing"
  | "published"
  | "failed"
  | "needs_reconnect"
  | "queued";

/** Health of a connected social account. */
export type AccountStatus = "connected" | "needs_reconnect" | "limited";
