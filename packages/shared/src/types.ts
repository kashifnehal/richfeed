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

/** Media type of a scheduled post's attached media. */
export type MediaType = "image" | "video" | "carousel";

// ---------------------------------------------------------------------
// API response DTOs — shared shape between apps/api and apps/web.
// ---------------------------------------------------------------------

export interface SocialAccountDto {
  id: string;
  platform: Platform;
  platformAccountId: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: AccountStatus;
  connectedAt: string;
}

export interface PublishAttemptDto {
  id: string;
  attemptedAt: string;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptNumber: number;
}

export interface PostTargetDto {
  id: string;
  scheduledPostId: string;
  socialAccountId: string;
  publishAt: string;
  platformCaptionOverride: string | null;
  status: PostTargetStatus;
  platformPostId: string | null;
  account: SocialAccountDto | null;
  publishAttempts?: PublishAttemptDto[];
}

export interface ScheduledPostDto {
  id: string;
  caption: string | null;
  hashtags: string[] | null;
  mediaUrls: string[] | null;
  mediaType: MediaType | null;
  createdAt: string;
  updatedAt: string;
  targets: PostTargetDto[];
}

export interface WorkspaceDto {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferencesDto {
  notifyOnFailedPost: boolean;
  notifyOnNeedsReconnect: boolean;
}
