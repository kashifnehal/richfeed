import type { PostTargetStatus } from "@richfeed/shared";
import { getSupabaseClient } from "./supabase";

/**
 * Typed query layer over the Step-2 schema (supabase/migrations/0001_init_schema.sql).
 * All functions use the service-role client from getSupabaseClient() and throw a
 * clear, typed error instead of silently swallowing a Supabase error.
 */

export class DbError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message);
    this.name = "DbError";
  }
}

export interface ScheduledPostRow {
  id: string;
  user_id: string;
  caption: string | null;
  hashtags: string[] | null;
  media_urls: string[] | null;
  media_type: "image" | "video" | "carousel" | null;
  created_at: string;
  updated_at: string;
}

export interface PostTargetRow {
  id: string;
  scheduled_post_id: string;
  social_account_id: string;
  publish_at: string;
  platform_caption_override: string | null;
  status: PostTargetStatus;
  platform_post_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublishAttemptRow {
  id: string;
  post_target_id: string;
  attempted_at: string;
  http_status: number | null;
  error_code: string | null;
  error_message: string | null;
  attempt_number: number;
}

export interface CreateScheduledPostInput {
  caption?: string | null;
  hashtags?: string[] | null;
  mediaUrls?: string[] | null;
  mediaType?: "image" | "video" | "carousel" | null;
}

export interface RecordPublishAttemptInput {
  httpStatus?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  attemptNumber: number;
}

export async function createScheduledPost(
  userId: string,
  input: CreateScheduledPostInput,
): Promise<ScheduledPostRow> {
  const { data, error } = await getSupabaseClient()
    .from("scheduled_posts")
    .insert({
      user_id: userId,
      caption: input.caption ?? null,
      hashtags: input.hashtags ?? null,
      media_urls: input.mediaUrls ?? null,
      media_type: input.mediaType ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new DbError(`Failed to create scheduled post: ${error.message}`, error);
  }

  return data as ScheduledPostRow;
}

export async function addPostTarget(
  scheduledPostId: string,
  socialAccountId: string,
  publishAt: Date,
  captionOverride?: string | null,
): Promise<PostTargetRow> {
  const { data, error } = await getSupabaseClient()
    .from("post_targets")
    .insert({
      scheduled_post_id: scheduledPostId,
      social_account_id: socialAccountId,
      publish_at: publishAt.toISOString(),
      platform_caption_override: captionOverride ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new DbError(`Failed to add post target: ${error.message}`, error);
  }

  return data as PostTargetRow;
}

export async function getPostTarget(id: string): Promise<PostTargetRow | null> {
  const { data, error } = await getSupabaseClient()
    .from("post_targets")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new DbError(`Failed to get post target ${id}: ${error.message}`, error);
  }

  return (data as PostTargetRow | null) ?? null;
}

export async function updatePostTargetStatus(
  id: string,
  status: PostTargetStatus,
  platformPostId?: string,
): Promise<PostTargetRow> {
  const update: Record<string, unknown> = { status };
  if (platformPostId !== undefined) {
    update.platform_post_id = platformPostId;
  }

  const { data, error } = await getSupabaseClient()
    .from("post_targets")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new DbError(
      `Failed to update post target ${id} to status ${status}: ${error.message}`,
      error,
    );
  }

  return data as PostTargetRow;
}

export async function recordPublishAttempt(
  postTargetId: string,
  result: RecordPublishAttemptInput,
): Promise<PublishAttemptRow> {
  const { data, error } = await getSupabaseClient()
    .from("publish_attempts")
    .insert({
      post_target_id: postTargetId,
      http_status: result.httpStatus ?? null,
      error_code: result.errorCode ?? null,
      error_message: result.errorMessage ?? null,
      attempt_number: result.attemptNumber,
    })
    .select()
    .single();

  if (error) {
    throw new DbError(
      `Failed to record publish attempt for post target ${postTargetId}: ${error.message}`,
      error,
    );
  }

  return data as PublishAttemptRow;
}

export async function listUpcomingTargets(
  userId: string,
  opts?: { limit?: number },
): Promise<PostTargetRow[]> {
  const { data, error } = await getSupabaseClient()
    .from("post_targets")
    .select("*, scheduled_posts!inner(user_id)")
    .eq("scheduled_posts.user_id", userId)
    .in("status", ["pending", "queued"])
    .order("publish_at", { ascending: true })
    .limit(opts?.limit ?? 50);

  if (error) {
    throw new DbError(
      `Failed to list upcoming targets for user ${userId}: ${error.message}`,
      error,
    );
  }

  return (data as PostTargetRow[]) ?? [];
}
