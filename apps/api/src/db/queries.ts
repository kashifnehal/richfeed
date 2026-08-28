import type {
  AccountStatus,
  MediaType,
  Platform,
  PostTargetDto,
  PostTargetStatus,
  ScheduledPostDto,
  SocialAccountDto,
} from "@richfeed/shared";
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

// ---------------------------------------------------------------------
// Step 3 additions — REST API surface for accounts / posts.
// All functions below take `userId` explicitly and filter by it (directly
// or via a join to scheduled_posts.user_id) since these run on the
// service-role client, which bypasses RLS. RLS remains the DB-level
// backstop; these filters are the API-level backstop.
// ---------------------------------------------------------------------

interface SocialAccountRawRow {
  id: string;
  platform: string;
  platform_account_id: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  connected_at: string;
}

interface PublishAttemptRawRow {
  id: string;
  attempted_at: string;
  http_status: number | null;
  error_code: string | null;
  error_message: string | null;
  attempt_number: number;
}

interface PostTargetRawRow {
  id: string;
  scheduled_post_id: string;
  social_account_id: string;
  publish_at: string;
  platform_caption_override: string | null;
  status: string;
  platform_post_id: string | null;
  social_accounts: SocialAccountRawRow | null;
  publish_attempts?: PublishAttemptRawRow[] | null;
}

interface ScheduledPostRawRow {
  id: string;
  caption: string | null;
  hashtags: string[] | null;
  media_urls: string[] | null;
  media_type: string | null;
  created_at: string;
  updated_at: string;
  post_targets?: PostTargetRawRow[] | null;
}

function mapAccount(row: SocialAccountRawRow): SocialAccountDto {
  return {
    id: row.id,
    platform: row.platform as Platform,
    platformAccountId: row.platform_account_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status as AccountStatus,
    connectedAt: row.connected_at,
  };
}

function mapTarget(row: PostTargetRawRow): PostTargetDto {
  return {
    id: row.id,
    scheduledPostId: row.scheduled_post_id,
    socialAccountId: row.social_account_id,
    publishAt: row.publish_at,
    platformCaptionOverride: row.platform_caption_override,
    status: row.status as PostTargetStatus,
    platformPostId: row.platform_post_id,
    account: row.social_accounts ? mapAccount(row.social_accounts) : null,
    publishAttempts: row.publish_attempts?.map((a) => ({
      id: a.id,
      attemptedAt: a.attempted_at,
      httpStatus: a.http_status,
      errorCode: a.error_code,
      errorMessage: a.error_message,
      attemptNumber: a.attempt_number,
    })),
  };
}

function mapPost(row: ScheduledPostRawRow): ScheduledPostDto {
  return {
    id: row.id,
    caption: row.caption,
    hashtags: row.hashtags,
    mediaUrls: row.media_urls,
    mediaType: row.media_type as MediaType | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    targets: (row.post_targets ?? []).map(mapTarget),
  };
}

const TARGET_EMBED = "*, social_accounts(*), publish_attempts(*)";

// ----- Accounts ---------------------------------------------------------

export async function listSocialAccounts(userId: string): Promise<SocialAccountDto[]> {
  const { data, error } = await getSupabaseClient()
    .from("social_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false });

  if (error) {
    throw new DbError(`Failed to list social accounts for user ${userId}: ${error.message}`, error);
  }

  return ((data as SocialAccountRawRow[]) ?? []).map(mapAccount);
}

export async function deleteSocialAccount(userId: string, id: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from("social_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw new DbError(`Failed to disconnect social account ${id}: ${error.message}`, error);
  }

  return (data?.length ?? 0) > 0;
}

// ----- Posts --------------------------------------------------------------

export interface ListPostsFilters {
  statuses?: PostTargetStatus[];
  from?: string;
  to?: string;
}

export async function listScheduledPostsWithTargets(
  userId: string,
  filters: ListPostsFilters = {},
): Promise<ScheduledPostDto[]> {
  const hasTargetFilter = Boolean(filters.statuses?.length || filters.from || filters.to);
  const targetsSelect = hasTargetFilter
    ? `post_targets!inner(${TARGET_EMBED})`
    : `post_targets(${TARGET_EMBED})`;

  let query = getSupabaseClient()
    .from("scheduled_posts")
    .select(`*, ${targetsSelect}`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filters.statuses?.length) {
    query = query.in("post_targets.status", filters.statuses);
  }
  if (filters.from) {
    query = query.gte("post_targets.publish_at", filters.from);
  }
  if (filters.to) {
    query = query.lte("post_targets.publish_at", filters.to);
  }

  const { data, error } = await query;

  if (error) {
    throw new DbError(`Failed to list posts for user ${userId}: ${error.message}`, error);
  }

  return ((data as ScheduledPostRawRow[]) ?? []).map(mapPost);
}

export async function getScheduledPostDetail(
  userId: string,
  id: string,
): Promise<ScheduledPostDto | null> {
  const { data, error } = await getSupabaseClient()
    .from("scheduled_posts")
    .select(`*, post_targets(${TARGET_EMBED})`)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new DbError(`Failed to get post ${id}: ${error.message}`, error);
  }

  return data ? mapPost(data as ScheduledPostRawRow) : null;
}

export interface CreatePostWithTargetsInput {
  caption?: string | null;
  hashtags?: string[] | null;
  mediaUrls?: string[] | null;
  mediaType?: MediaType | null;
  targets: { socialAccountId: string; publishAt: string; captionOverride?: string | null }[];
}

export async function createScheduledPostWithTargets(
  userId: string,
  input: CreatePostWithTargetsInput,
): Promise<ScheduledPostDto> {
  const post = await createScheduledPost(userId, {
    caption: input.caption,
    hashtags: input.hashtags,
    mediaUrls: input.mediaUrls,
    mediaType: input.mediaType,
  });

  if (input.targets.length > 0) {
    const { error } = await getSupabaseClient()
      .from("post_targets")
      .insert(
        input.targets.map((t) => ({
          scheduled_post_id: post.id,
          social_account_id: t.socialAccountId,
          publish_at: t.publishAt,
          platform_caption_override: t.captionOverride ?? null,
        })),
      );

    if (error) {
      throw new DbError(`Failed to add targets for post ${post.id}: ${error.message}`, error);
    }
  }

  const detail = await getScheduledPostDetail(userId, post.id);
  if (!detail) {
    throw new DbError(`Post ${post.id} not found immediately after creation`, null);
  }
  return detail;
}

export interface UpdatePostFieldsInput {
  caption?: string | null;
  hashtags?: string[] | null;
  mediaUrls?: string[] | null;
  mediaType?: MediaType | null;
}

export async function updateScheduledPostFields(
  userId: string,
  id: string,
  patch: UpdatePostFieldsInput,
): Promise<ScheduledPostDto | null> {
  const update: Record<string, unknown> = {};
  if (patch.caption !== undefined) update.caption = patch.caption;
  if (patch.hashtags !== undefined) update.hashtags = patch.hashtags;
  if (patch.mediaUrls !== undefined) update.media_urls = patch.mediaUrls;
  if (patch.mediaType !== undefined) update.media_type = patch.mediaType;

  const { data, error } = await getSupabaseClient()
    .from("scheduled_posts")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw new DbError(`Failed to update post ${id}: ${error.message}`, error);
  }
  if (!data || data.length === 0) {
    return null;
  }

  return getScheduledPostDetail(userId, id);
}

/** Verifies `targetId` belongs to `userId` (via its parent scheduled_post) and returns it, or null. */
async function getOwnedTarget(
  userId: string,
  targetId: string,
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await getSupabaseClient()
    .from("post_targets")
    .select("id, status, scheduled_posts!inner(user_id)")
    .eq("id", targetId)
    .eq("scheduled_posts.user_id", userId)
    .maybeSingle();

  if (error) {
    throw new DbError(`Failed to look up target ${targetId}: ${error.message}`, error);
  }
  return data ? { id: data.id as string, status: data.status as string } : null;
}

export type RescheduleResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_published" };

export async function rescheduleTarget(
  userId: string,
  targetId: string,
  publishAt: string,
): Promise<RescheduleResult> {
  const target = await getOwnedTarget(userId, targetId);
  if (!target) return { ok: false, reason: "not_found" };
  if (target.status === "published") return { ok: false, reason: "already_published" };

  const nextStatus = target.status === "failed" ? "pending" : target.status;

  const { error } = await getSupabaseClient()
    .from("post_targets")
    .update({ publish_at: publishAt, status: nextStatus })
    .eq("id", targetId);

  if (error) {
    throw new DbError(`Failed to reschedule target ${targetId}: ${error.message}`, error);
  }
  return { ok: true };
}

export async function cancelTarget(
  userId: string,
  targetId: string,
): Promise<RescheduleResult> {
  const target = await getOwnedTarget(userId, targetId);
  if (!target) return { ok: false, reason: "not_found" };
  if (target.status === "published") return { ok: false, reason: "already_published" };

  const { error } = await getSupabaseClient().from("post_targets").delete().eq("id", targetId);

  if (error) {
    throw new DbError(`Failed to cancel target ${targetId}: ${error.message}`, error);
  }
  return { ok: true };
}

export async function cancelAllTargetsForPost(userId: string, postId: string): Promise<boolean> {
  const { data: postRow, error: postErr } = await getSupabaseClient()
    .from("scheduled_posts")
    .select("id")
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (postErr) {
    throw new DbError(`Failed to look up post ${postId}: ${postErr.message}`, postErr);
  }
  if (!postRow) return false;

  const { error } = await getSupabaseClient()
    .from("post_targets")
    .delete()
    .eq("scheduled_post_id", postId)
    .neq("status", "published");

  if (error) {
    throw new DbError(`Failed to cancel targets for post ${postId}: ${error.message}`, error);
  }
  return true;
}

export async function duplicatePostToAccount(
  userId: string,
  postId: string,
  socialAccountId: string,
  publishAt: string,
): Promise<ScheduledPostDto | null> {
  const supabase = getSupabaseClient();

  const { data: original, error: origErr } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (origErr) {
    throw new DbError(`Failed to look up post ${postId}: ${origErr.message}`, origErr);
  }
  if (!original) return null;

  const { data: account, error: acctErr } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("id", socialAccountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (acctErr) {
    throw new DbError(`Failed to look up account ${socialAccountId}: ${acctErr.message}`, acctErr);
  }
  if (!account) return null;

  const originalRow = original as ScheduledPostRawRow;

  return createScheduledPostWithTargets(userId, {
    caption: originalRow.caption,
    hashtags: originalRow.hashtags,
    mediaUrls: originalRow.media_urls,
    mediaType: originalRow.media_type as MediaType | null,
    targets: [{ socialAccountId, publishAt }],
  });
}

// ----- Dashboard ------------------------------------------------------

export interface DashboardStats {
  scheduledThisWeek: number;
  publishedLast7Days: number;
  failedCount: number;
  accountsNeedingReconnect: number;
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  const [scheduled, published, failed, reconnect] = await Promise.all([
    supabase
      .from("post_targets")
      .select("id, scheduled_posts!inner(user_id)", { count: "exact", head: true })
      .eq("scheduled_posts.user_id", userId)
      .in("status", ["pending", "queued"])
      .gte("publish_at", nowIso)
      .lte("publish_at", weekFromNow),
    supabase
      .from("post_targets")
      .select("id, scheduled_posts!inner(user_id)", { count: "exact", head: true })
      .eq("scheduled_posts.user_id", userId)
      .eq("status", "published")
      .gte("updated_at", weekAgo),
    supabase
      .from("post_targets")
      .select("id, scheduled_posts!inner(user_id)", { count: "exact", head: true })
      .eq("scheduled_posts.user_id", userId)
      .eq("status", "failed"),
    supabase
      .from("social_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "needs_reconnect"),
  ]);

  for (const r of [scheduled, published, failed, reconnect]) {
    if (r.error) {
      throw new DbError(`Failed to compute dashboard stats: ${r.error.message}`, r.error);
    }
  }

  return {
    scheduledThisWeek: scheduled.count ?? 0,
    publishedLast7Days: published.count ?? 0,
    failedCount: failed.count ?? 0,
    accountsNeedingReconnect: reconnect.count ?? 0,
  };
}

export interface AttentionItems {
  failedTargets: PostTargetDto[];
  accountsNeedingReconnect: SocialAccountDto[];
}

export async function getAttentionItems(userId: string): Promise<AttentionItems> {
  const supabase = getSupabaseClient();

  const [failedRes, reconnectRes] = await Promise.all([
    supabase
      .from("post_targets")
      .select(`*, scheduled_posts!inner(user_id, caption), social_accounts(*)`)
      .eq("scheduled_posts.user_id", userId)
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("social_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "needs_reconnect")
      .order("updated_at", { ascending: false }),
  ]);

  if (failedRes.error) {
    throw new DbError(`Failed to list failed targets: ${failedRes.error.message}`, failedRes.error);
  }
  if (reconnectRes.error) {
    throw new DbError(
      `Failed to list accounts needing reconnect: ${reconnectRes.error.message}`,
      reconnectRes.error,
    );
  }

  return {
    failedTargets: ((failedRes.data as PostTargetRawRow[]) ?? []).map(mapTarget),
    accountsNeedingReconnect: ((reconnectRes.data as SocialAccountRawRow[]) ?? []).map(mapAccount),
  };
}

export async function getUpcomingPreview(userId: string, limit = 5): Promise<PostTargetDto[]> {
  const { data, error } = await getSupabaseClient()
    .from("post_targets")
    .select(`*, scheduled_posts!inner(user_id), social_accounts(*)`)
    .eq("scheduled_posts.user_id", userId)
    .in("status", ["pending", "queued"])
    .order("publish_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new DbError(`Failed to get upcoming preview for user ${userId}: ${error.message}`, error);
  }

  return ((data as PostTargetRawRow[]) ?? []).map(mapTarget);
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
