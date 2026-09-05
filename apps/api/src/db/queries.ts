import type {
  AccountStatus,
  MediaType,
  NotificationPreferencesDto,
  Platform,
  PostTargetDto,
  PostTargetStatus,
  ScheduledPostDto,
  SocialAccountDto,
  WorkspaceDto,
} from "@richfeed/shared";
import { getSupabaseClient } from "./supabase";
import { enqueuePublishJob, getPublishQueue, publishJobId } from "../queue/scheduler";

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
  permalink_url: string | null;
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
  permalinkUrl?: string,
): Promise<PostTargetRow> {
  const update: Record<string, unknown> = { status };
  if (platformPostId !== undefined) {
    update.platform_post_id = platformPostId;
  }
  if (permalinkUrl !== undefined) {
    update.permalink_url = permalinkUrl;
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

export interface PublishJobContext {
  target: PostTargetRow;
  post: { caption: string | null; hashtags: string[] | null; mediaUrls: string[] | null; mediaType: MediaType | null };
  account: SocialAccountFullRawRow;
}

interface PostTargetForPublishRawRow extends PostTargetRow {
  scheduled_posts: ScheduledPostRow | null;
  social_accounts: SocialAccountFullRawRow | null;
}

/** Everything a worker job needs to dispatch a publish: the target, its parent post's content, and the target account's platform + tokens. */
export async function getPublishJobContext(postTargetId: string): Promise<PublishJobContext | null> {
  const { data, error } = await getSupabaseClient()
    .from("post_targets")
    .select("*, scheduled_posts(*), social_accounts(*)")
    .eq("id", postTargetId)
    .maybeSingle();

  if (error) {
    throw new DbError(`Failed to load publish context for post target ${postTargetId}: ${error.message}`, error);
  }
  if (!data) return null;

  const row = data as unknown as PostTargetForPublishRawRow;
  if (!row.scheduled_posts || !row.social_accounts) {
    throw new DbError(`Post target ${postTargetId} is missing its parent post or account`, null);
  }

  return {
    target: row,
    post: {
      caption: row.scheduled_posts.caption,
      hashtags: row.scheduled_posts.hashtags,
      mediaUrls: row.scheduled_posts.media_urls,
      mediaType: row.scheduled_posts.media_type as MediaType | null,
    },
    account: row.social_accounts,
  };
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
  platform_username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  connected_at: string;
}

interface SocialAccountFullRawRow extends SocialAccountRawRow {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
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
  permalink_url: string | null;
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
    platformUsername: row.platform_username,
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
    permalinkUrl: row.permalink_url,
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

/** Soft-disconnect: flips status to 'disconnected'. post_targets/publish_attempts are left untouched — history stays intact. */
export async function disconnectSocialAccount(userId: string, id: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from("social_accounts")
    .update({ status: "disconnected" })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw new DbError(`Failed to disconnect social account ${id}: ${error.message}`, error);
  }

  return (data?.length ?? 0) > 0;
}

export type DeleteAccountResult = { ok: true } | { ok: false; reason: "not_found" | "has_targets" };

/** Permanent removal — only allowed once zero post_targets reference the account (its non-cascading FK would otherwise 500). */
export async function deleteSocialAccountPermanently(userId: string, id: string): Promise<DeleteAccountResult> {
  const supabase = getSupabaseClient();

  const { data: account, error: lookupErr } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupErr) {
    throw new DbError(`Failed to look up social account ${id}: ${lookupErr.message}`, lookupErr);
  }
  if (!account) return { ok: false, reason: "not_found" };

  const { count, error: targetsErr } = await supabase
    .from("post_targets")
    .select("id", { count: "exact", head: true })
    .eq("social_account_id", id);

  if (targetsErr) {
    throw new DbError(`Failed to check targets for account ${id}: ${targetsErr.message}`, targetsErr);
  }
  if ((count ?? 0) > 0) {
    return { ok: false, reason: "has_targets" };
  }

  const { error } = await supabase.from("social_accounts").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    throw new DbError(`Failed to remove social account ${id}: ${error.message}`, error);
  }

  return { ok: true };
}

export interface UpsertSocialAccountInput {
  userId: string;
  platform: Platform;
  platformAccountId: string;
  /** Not every platform's identity call returns a human handle (e.g. a Facebook Page just has a name). */
  platformUsername?: string | null;
  displayName: string;
  /** Not every identity call returns a profile picture (e.g. a Facebook Page). */
  avatarUrl?: string | null;
  accessTokenEncrypted: string;
  /** Null for platforms with no separate refresh token (Instagram/Facebook/Threads all re-exchange the same long-lived token instead — see each platforms/*.md). */
  refreshTokenEncrypted?: string | null;
  /** Null for a token that doesn't expire on a known clock (e.g. a Facebook Page token). */
  tokenExpiresAt?: string | null;
  scopes: string[];
}

/** Insert-or-update-in-place on (user_id, platform, platform_account_id) — the reconnect path just updates the existing row. */
export async function upsertSocialAccount(input: UpsertSocialAccountInput): Promise<SocialAccountDto> {
  const { data, error } = await getSupabaseClient()
    .from("social_accounts")
    .upsert(
      {
        user_id: input.userId,
        platform: input.platform,
        platform_account_id: input.platformAccountId,
        platform_username: input.platformUsername ?? null,
        display_name: input.displayName,
        avatar_url: input.avatarUrl ?? null,
        access_token: input.accessTokenEncrypted,
        refresh_token: input.refreshTokenEncrypted ?? null,
        token_expires_at: input.tokenExpiresAt ?? null,
        scopes: input.scopes,
        status: "connected",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform,platform_account_id" },
    )
    .select()
    .single();

  if (error) {
    throw new DbError(`Failed to upsert social account for user ${input.userId}: ${error.message}`, error);
  }

  return mapAccount(data as SocialAccountRawRow);
}

export interface UpdateSocialAccountTokensInput {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: string;
}

/** Persists a rotated access/refresh token pair after a platform adapter refreshes them mid-publish. */
export async function updateSocialAccountTokens(id: string, patch: UpdateSocialAccountTokensInput): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("social_accounts")
    .update({
      access_token: patch.accessTokenEncrypted,
      refresh_token: patch.refreshTokenEncrypted,
      token_expires_at: patch.tokenExpiresAt,
    })
    .eq("id", id);

  if (error) {
    throw new DbError(`Failed to update tokens for social account ${id}: ${error.message}`, error);
  }
}

/** Flips an account to needs_reconnect after a platform adapter reports an auth failure (401/403, or an unrefreshable token). */
export async function markSocialAccountNeedsReconnect(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("social_accounts")
    .update({ status: "needs_reconnect" })
    .eq("id", id);

  if (error) {
    throw new DbError(`Failed to flag social account ${id} as needs_reconnect: ${error.message}`, error);
  }
}

// ----- Posts --------------------------------------------------------------

export interface ListPostsFilters {
  statuses?: PostTargetStatus[];
  /** Filter to targets whose social account is on one of these platforms. */
  platforms?: Platform[];
  from?: string;
  to?: string;
}

export interface PostTargetsPageFilters extends ListPostsFilters {
  /** Max post_targets (rows) to return. */
  limit: number;
  /** Row offset into the ordered post_targets set. Default 0. */
  offset?: number;
  /** Sort direction on publish_at. Default "asc" (soonest first). */
  sort?: "asc" | "desc";
}

export interface PostTargetsPage {
  /** Posts that own the targets in this page — each carries only this page's targets. */
  posts: ScheduledPostDto[];
  /** Total matching post_targets across all pages (for "N remaining"). */
  total: number;
  /** Whether another page exists after this one. */
  hasMore: boolean;
}

interface PostTargetWithPostRawRow extends PostTargetRawRow {
  scheduled_posts: ScheduledPostRawRow | null;
}

/**
 * Server-side paginated variant of listScheduledPostsWithTargets, rooted at
 * post_targets so a "page" is exactly `limit` queue rows (the Queue renders
 * one row per target). Targets are regrouped into their parent posts for the
 * shared ScheduledPostDto response shape; a post whose targets straddle a
 * page boundary appears in both pages with its respective subset of targets,
 * which flattenToQueueRows on the client handles transparently.
 */
export async function listScheduledPostTargetsPage(
  userId: string,
  filters: PostTargetsPageFilters,
): Promise<PostTargetsPage> {
  const offset = Math.max(0, filters.offset ?? 0);
  const limit = Math.max(1, filters.limit);
  const ascending = filters.sort !== "desc";

  // When filtering by platform we need an inner join to social_accounts so the
  // `.in(social_accounts.platform, ...)` filter (and the exact count) actually
  // constrains the row set, not just the embedded payload. Kept as two string
  // literals (not an interpolation) so the client keeps its select typing.
  const select = filters.platforms?.length
    ? "*, social_accounts!inner(*), publish_attempts(*), scheduled_posts!inner(*)"
    : "*, social_accounts(*), publish_attempts(*), scheduled_posts!inner(*)";

  let query = getSupabaseClient()
    .from("post_targets")
    .select(select, { count: "exact" })
    .eq("scheduled_posts.user_id", userId)
    .order("publish_at", { ascending })
    // Stable tiebreak so rows never shuffle between pages when publish_at ties.
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (filters.statuses?.length) {
    query = query.in("status", filters.statuses);
  }
  if (filters.platforms?.length) {
    query = query.in("social_accounts.platform", filters.platforms);
  }
  if (filters.from) {
    query = query.gte("publish_at", filters.from);
  }
  if (filters.to) {
    query = query.lte("publish_at", filters.to);
  }

  const { data, error, count } = await query;

  if (error) {
    // PostgREST returns "range not satisfiable" (PGRST103) when `offset` is
    // past the end of the result set — treat that as an empty trailing page
    // rather than an error, since the Queue can legitimately request it.
    if (error.code === "PGRST103") {
      return { posts: [], total: count ?? offset, hasMore: false };
    }
    throw new DbError(`Failed to page posts for user ${userId}: ${error.message}`, error);
  }

  const rows = (data as unknown as PostTargetWithPostRawRow[]) ?? [];
  const byPostId = new Map<string, ScheduledPostDto>();
  const order: string[] = [];
  for (const row of rows) {
    const postRow = row.scheduled_posts;
    if (!postRow) continue;
    if (!byPostId.has(postRow.id)) {
      byPostId.set(postRow.id, { ...mapPost({ ...postRow, post_targets: [] }), targets: [] });
      order.push(postRow.id);
    }
    byPostId.get(postRow.id)!.targets.push(mapTarget(row));
  }

  const total = count ?? 0;
  return {
    posts: order.map((id) => byPostId.get(id)!),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function listScheduledPostsWithTargets(
  userId: string,
  filters: ListPostsFilters = {},
): Promise<ScheduledPostDto[]> {
  const hasTargetFilter = Boolean(
    filters.statuses?.length || filters.platforms?.length || filters.from || filters.to,
  );
  // Inner-join post_targets when any target-level filter is active, and
  // inner-join social_accounts on top of that only when filtering by platform,
  // so filters actually drop non-matching rows rather than just emptying the
  // embed. Spelled out as literals so the client keeps its select typing.
  let select: string;
  if (filters.platforms?.length) {
    select = "*, post_targets!inner(*, social_accounts!inner(*), publish_attempts(*))";
  } else if (hasTargetFilter) {
    select = "*, post_targets!inner(*, social_accounts(*), publish_attempts(*))";
  } else {
    select = "*, post_targets(*, social_accounts(*), publish_attempts(*))";
  }

  let query = getSupabaseClient()
    .from("scheduled_posts")
    .select(select)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filters.statuses?.length) {
    query = query.in("post_targets.status", filters.statuses);
  }
  if (filters.platforms?.length) {
    query = query.in("post_targets.social_accounts.platform", filters.platforms);
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

  return ((data as unknown as ScheduledPostRawRow[]) ?? []).map(mapPost);
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
    const { data: inserted, error } = await getSupabaseClient()
      .from("post_targets")
      .insert(
        input.targets.map((t) => ({
          scheduled_post_id: post.id,
          social_account_id: t.socialAccountId,
          publish_at: t.publishAt,
          platform_caption_override: t.captionOverride ?? null,
        })),
      )
      .select("id, publish_at");

    if (error) {
      throw new DbError(`Failed to add targets for post ${post.id}: ${error.message}`, error);
    }

    // Hand every newly-created target to the publish queue — this is the
    // step that used to be missing entirely, so nothing scheduled through
    // the real product ever actually reached the worker (see CHANGELOG).
    for (const target of (inserted ?? []) as { id: string; publish_at: string }[]) {
      await enqueuePublishJob(target.id, new Date(target.publish_at));
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

  await enqueuePublishJob(targetId, new Date(publishAt));
  return { ok: true };
}

/**
 * Best-effort removal of a target's queued publish job. A delayed job left
 * behind after its target row is deleted would just fail loudly and
 * harmlessly later (getPublishJobContext returns null), so this is cleanup
 * for noise, not a safety requirement — swallow any error.
 */
async function removePublishJob(targetId: string): Promise<void> {
  try {
    const job = await getPublishQueue().getJob(publishJobId(targetId));
    await job?.remove();
  } catch (err) {
    console.warn(`[queries] failed to remove publish job for target ${targetId}:`, err);
  }
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
  await removePublishJob(targetId);
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

  const { data: cancelable, error: lookupErr } = await getSupabaseClient()
    .from("post_targets")
    .select("id")
    .eq("scheduled_post_id", postId)
    .neq("status", "published");

  if (lookupErr) {
    throw new DbError(`Failed to look up targets for post ${postId}: ${lookupErr.message}`, lookupErr);
  }

  const { error } = await getSupabaseClient()
    .from("post_targets")
    .delete()
    .eq("scheduled_post_id", postId)
    .neq("status", "published");

  if (error) {
    throw new DbError(`Failed to cancel targets for post ${postId}: ${error.message}`, error);
  }

  await Promise.all(((cancelable ?? []) as { id: string }[]).map((t) => removePublishJob(t.id)));
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
      .in("status", ["failed", "needs_reconnect"]),
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
      .in("status", ["failed", "needs_reconnect"])
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

// ----- Workspace -----------------------------------------------------

interface WorkspaceRawRow {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

function mapWorkspace(row: WorkspaceRawRow): WorkspaceDto {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function selectWorkspace(userId: string): Promise<WorkspaceRawRow | null> {
  const { data, error } = await getSupabaseClient()
    .from("workspaces")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DbError(`Failed to load workspace for user ${userId}: ${error.message}`, error);
  }
  return (data as WorkspaceRawRow | null) ?? null;
}

/**
 * Returns the user's workspace, creating one if it's somehow missing (the
 * `on_auth_user_created_create_workspace` trigger + the 0002 backfill mean
 * this practically never fires, but a user created in the gap between the two
 * would have none).
 */
export async function ensureWorkspaceForUser(
  userId: string,
  fallbackName: string,
): Promise<WorkspaceDto> {
  const existing = await selectWorkspace(userId);
  if (existing) return mapWorkspace(existing);

  const { data, error } = await getSupabaseClient()
    .from("workspaces")
    .insert({ name: fallbackName, owner_user_id: userId })
    .select()
    .single();

  if (error) {
    throw new DbError(`Failed to create workspace for user ${userId}: ${error.message}`, error);
  }
  return mapWorkspace(data as WorkspaceRawRow);
}

export async function updateWorkspaceName(
  userId: string,
  name: string,
  fallbackName: string,
): Promise<WorkspaceDto> {
  // Make sure a row exists first, then rename it (scoped to the owner).
  const workspace = await ensureWorkspaceForUser(userId, fallbackName);

  const { data, error } = await getSupabaseClient()
    .from("workspaces")
    .update({ name })
    .eq("id", workspace.id)
    .eq("owner_user_id", userId)
    .select()
    .single();

  if (error) {
    throw new DbError(`Failed to rename workspace ${workspace.id}: ${error.message}`, error);
  }
  return mapWorkspace(data as WorkspaceRawRow);
}

// ----- Notification preferences -------------------------------------

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesDto = {
  notifyOnFailedPost: true,
  notifyOnNeedsReconnect: true,
};

interface NotificationPreferencesRawRow {
  user_id: string;
  notify_on_failed_post: boolean;
  notify_on_needs_reconnect: boolean;
}

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferencesDto> {
  const { data, error } = await getSupabaseClient()
    .from("notification_preferences")
    .select("notify_on_failed_post, notify_on_needs_reconnect")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new DbError(
      `Failed to load notification preferences for user ${userId}: ${error.message}`,
      error,
    );
  }

  const row = data as Pick<
    NotificationPreferencesRawRow,
    "notify_on_failed_post" | "notify_on_needs_reconnect"
  > | null;

  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return {
    notifyOnFailedPost: row.notify_on_failed_post,
    notifyOnNeedsReconnect: row.notify_on_needs_reconnect,
  };
}

export async function upsertNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferencesDto>,
): Promise<NotificationPreferencesDto> {
  const current = await getNotificationPreferences(userId);
  const next: NotificationPreferencesDto = { ...current, ...patch };

  const { error } = await getSupabaseClient()
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        notify_on_failed_post: next.notifyOnFailedPost,
        notify_on_needs_reconnect: next.notifyOnNeedsReconnect,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    throw new DbError(
      `Failed to save notification preferences for user ${userId}: ${error.message}`,
      error,
    );
  }
  return next;
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
