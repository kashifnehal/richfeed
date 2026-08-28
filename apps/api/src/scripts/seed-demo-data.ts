/**
 * Seeds the real database with realistic demo data for one real signed-up
 * user, so every page/state in the product can actually be clicked through
 * instead of only ever rendering EmptyState.
 *
 * Run with:
 *   pnpm --filter api seed -- --user <supabase-auth-user-uuid>
 *   (equivalent: tsx --env-file-if-exists=.env src/scripts/seed-demo-data.ts --user <uuid>)
 *
 * This script does NOT create the Supabase Auth user itself — pass the id of
 * a real account (sign up through the app, then find the id in the Supabase
 * dashboard's Authentication > Users list, or via `create-demo-user.ts`).
 *
 * Idempotent + destructive-only-toward-its-own-output: on every run (start
 * and, on failure, again in cleanup) it deletes every row this user owns in
 * publish_attempts / post_targets / scheduled_posts / social_accounts, in
 * FK-safe order, then re-inserts a full, fixed demo dataset. Re-running
 * always converges to the same clean, fully-seeded state.
 */

import { createHash } from "node:crypto";
import zlib from "node:zlib";
import { getSupabaseClient } from "../db/supabase";
import { encrypt } from "../lib/crypto";
import { MEDIA_BUCKET, uploadMedia } from "../lib/storage";
import type { AccountStatus, MediaType, Platform, PostTargetStatus } from "@richfeed/shared";

// ---------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------

function parseUserId(argv: string[]): string {
  let userId: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--user") {
      userId = argv[i + 1];
      break;
    }
    if (argv[i]?.startsWith("--user=")) {
      userId = argv[i]!.slice("--user=".length);
      break;
    }
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!userId || !UUID_RE.test(userId)) {
    console.error(
      [
        "",
        "Usage: pnpm --filter api seed -- --user <supabase-auth-user-uuid>",
        "",
        "  --user   Required. The UUID of a real Supabase Auth user (from the",
        "           Supabase dashboard's Authentication > Users list, or from",
        "           `pnpm --filter api create-demo-user`).",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  return userId;
}

// ---------------------------------------------------------------------
// Tiny dependency-free PNG encoder — generates real, valid solid-color
// placeholder images so media rendering is against real Supabase Storage
// files, not an external image host that might 404.
// ---------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/** Generates a real, valid solid-color PNG. */
function makeSolidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const stride = width * 3 + 1; // +1 filter-type byte per scanline
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const off = rowStart + 1 + x * 3;
      raw[off] = rgb[0];
      raw[off + 1] = rgb[1];
      raw[off + 2] = rgb[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------
// Cleanup — idempotent, FK-safe delete of everything this user owns.
// ---------------------------------------------------------------------

async function cleanupUserData(userId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: posts, error: postsErr } = await supabase
    .from("scheduled_posts")
    .select("id")
    .eq("user_id", userId);
  if (postsErr) throw new Error(`cleanup: failed to list scheduled_posts: ${postsErr.message}`);
  const postIds = (posts ?? []).map((p) => p.id as string);

  let targetIds: string[] = [];
  if (postIds.length > 0) {
    const { data: targets, error: targetsErr } = await supabase
      .from("post_targets")
      .select("id")
      .in("scheduled_post_id", postIds);
    if (targetsErr) throw new Error(`cleanup: failed to list post_targets: ${targetsErr.message}`);
    targetIds = (targets ?? []).map((t) => t.id as string);
  }

  if (targetIds.length > 0) {
    const { error } = await supabase.from("publish_attempts").delete().in("post_target_id", targetIds);
    if (error) throw new Error(`cleanup: failed to delete publish_attempts: ${error.message}`);
  }

  if (postIds.length > 0) {
    const { error } = await supabase.from("post_targets").delete().in("scheduled_post_id", postIds);
    if (error) throw new Error(`cleanup: failed to delete post_targets: ${error.message}`);
  }

  {
    const { error } = await supabase.from("scheduled_posts").delete().eq("user_id", userId);
    if (error) throw new Error(`cleanup: failed to delete scheduled_posts: ${error.message}`);
  }

  {
    const { error } = await supabase.from("social_accounts").delete().eq("user_id", userId);
    if (error) throw new Error(`cleanup: failed to delete social_accounts: ${error.message}`);
  }

  // Also clear out any media this script previously uploaded for this user
  // (uploadMedia() namespaces every upload under `${userId}/...`), so
  // re-running doesn't silently accumulate orphaned storage files forever.
  {
    const { data: files, error: listError } = await supabase.storage.from(MEDIA_BUCKET).list(userId, {
      limit: 1000,
    });
    if (listError) {
      // Non-fatal — the bucket may not exist yet on a first-ever run.
      return;
    }
    if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
      if (removeError) {
        throw new Error(`cleanup: failed to delete old media files: ${removeError.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------
// Demo data spec
// ---------------------------------------------------------------------

interface AccountSpec {
  key: string;
  platform: Platform;
  displayName: string;
  status: AccountStatus;
  daysAgoConnected: number;
  avatarSeed: string;
}

const ACCOUNT_SPECS: AccountSpec[] = [
  { key: "li_connected", platform: "linkedin_personal", displayName: "Avery Chen", status: "connected", daysAgoConnected: 40, avatarSeed: "avery-chen" },
  { key: "li_reconnect", platform: "linkedin_personal", displayName: "Jordan Ellis", status: "needs_reconnect", daysAgoConnected: 65, avatarSeed: "jordan-ellis" },
  { key: "ig_main", platform: "instagram", displayName: "RichFeed HQ", status: "connected", daysAgoConnected: 50, avatarSeed: "richfeed-hq" },
  { key: "ig_creators", platform: "instagram", displayName: "RichFeed Creators", status: "connected", daysAgoConnected: 30, avatarSeed: "richfeed-creators" },
  { key: "fb_page", platform: "facebook", displayName: "RichFeed", status: "connected", daysAgoConnected: 55, avatarSeed: "richfeed-fb" },
  { key: "tw_main", platform: "twitter", displayName: "RichFeed HQ", status: "connected", daysAgoConnected: 45, avatarSeed: "richfeed-x" },
  { key: "yt_main", platform: "youtube", displayName: "RichFeed", status: "connected", daysAgoConnected: 60, avatarSeed: "richfeed-yt" },
  { key: "tt_main", platform: "tiktok", displayName: "RichFeed", status: "limited", daysAgoConnected: 20, avatarSeed: "richfeed-tt" },
  { key: "pin_main", platform: "pinterest", displayName: "RichFeed Ideas", status: "connected", daysAgoConnected: 15, avatarSeed: "richfeed-pin" },
];

const CAPTIONS = [
  "We just shipped a small but mighty update: dark mode is here. Toggle it in Settings and let us know what you think.",
  "Behind every great launch is a team that sweats the details. Meet the humans building RichFeed.",
  "Hot take: the best content calendar is the one you actually stick to. Here's how we stay consistent.",
  "Q3 numbers are in — we crossed 10,000 scheduled posts this quarter. Thank you for building with us.",
  "New feature alert: multi-account scheduling just got a lot smarter. One post, every platform, one click.",
  "Friday reminder: your audience is scrolling right now. Give them something worth stopping for.",
  "We sat down with five creators to talk about what actually moves the needle on engagement. Thread below.",
  "Big thanks to everyone who joined our webinar this week — the recording is up on the blog now.",
  "Consistency beats intensity. Post smart, not just often.",
  "Sneak peek: here's what we're building next for RichFeed.",
  "Customer spotlight: how one team cut their scheduling time in half using saved templates.",
  "Poll time: what's your biggest content bottleneck right now? Drop a comment.",
  "The algorithm doesn't care about your excuses. Neither do we. Schedule ahead.",
  "Live from the RichFeed office: coffee, code, and a lot of Slack notifications.",
  "Your Monday morning content plan, sorted before you even open your laptop.",
  "We're hiring! Come build the future of social scheduling with us.",
  "Case study: 3x engagement in 30 days using a simple, boring, repeatable posting cadence.",
  "Happy Friday — here's a quick recap of what shipped this week.",
  "Reminder: scheduled posts still need a human eye before they go out. Preview before you queue.",
  "We redesigned the queue view based on your feedback. Cleaner, faster, easier to scan.",
];

const HASHTAG_SETS: string[][] = [
  ["#productupdate", "#darkmode"],
  ["#teamculture"],
  ["#contentstrategy"],
  ["#milestone"],
  ["#newfeature"],
  ["#socialmedia"],
  ["#creators"],
  ["#webinar"],
  ["#consistency"],
  ["#comingsoon"],
  ["#customerstory"],
  ["#communitypoll"],
  ["#scheduling"],
  ["#buildinpublic"],
  ["#mondaymotivation"],
  ["#hiring"],
  ["#casestudy"],
  ["#weeklyrecap"],
  ["#tips"],
  ["#redesign"],
];

interface TargetSpec {
  accountKey: string;
  offsetHours: number; // relative to "now" — negative is in the past
  status: PostTargetStatus;
  platformCaptionOverride?: string;
  platformPostId?: string;
  attempts?: {
    offsetMinutesFromPublish: number;
    httpStatus: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    attemptNumber: number;
  }[];
}

interface PostSpec {
  captionIdx: number;
  hashtagsIdx: number | null;
  mediaIdx: number | null; // index into uploaded media urls, or null
  targets: TargetSpec[];
}

const H = 1;
const D = 24;

function buildPostSpecs(): PostSpec[] {
  return [
    // ----- Published (past ~2 weeks) -----
    { captionIdx: 0, hashtagsIdx: 0, mediaIdx: 0, targets: [{ accountKey: "ig_main", offsetHours: -13 * D, status: "published", platformPostId: "ig_demo_a1b2c3" }] },
    { captionIdx: 1, hashtagsIdx: 1, mediaIdx: 1, targets: [{ accountKey: "li_connected", offsetHours: -11 * D, status: "published", platformPostId: "li_demo_d4e5f6" }] },
    {
      captionIdx: 2,
      hashtagsIdx: 2,
      mediaIdx: null,
      targets: [
        { accountKey: "fb_page", offsetHours: -9 * D, status: "published", platformPostId: "fb_demo_g7h8i9" },
        { accountKey: "tw_main", offsetHours: -9 * D + 2, status: "published", platformPostId: "tw_demo_j1k2l3", platformCaptionOverride: "Hot take: the best content calendar is the one you actually stick to. 🧵" },
      ],
    },
    { captionIdx: 3, hashtagsIdx: 3, mediaIdx: 2, targets: [{ accountKey: "yt_main", offsetHours: -7 * D, status: "published", platformPostId: "yt_demo_m4n5o6" }] },
    {
      captionIdx: 17,
      hashtagsIdx: 17,
      mediaIdx: 3,
      targets: [
        { accountKey: "ig_main", offsetHours: -4 * D, status: "published", platformPostId: "ig_demo_p7q8r9" },
        { accountKey: "ig_creators", offsetHours: -4 * D + 1, status: "published", platformPostId: "ig_demo_s1t2u3" },
      ],
    },
    { captionIdx: 8, hashtagsIdx: 8, mediaIdx: null, targets: [{ accountKey: "pin_main", offsetHours: -2 * D, status: "published", platformPostId: "pin_demo_v4w5x6" }] },

    // ----- Publishing (mid-flight) -----
    { captionIdx: 9, hashtagsIdx: 9, mediaIdx: 0, targets: [{ accountKey: "ig_creators", offsetHours: -3 / 60, status: "publishing" }] },
    { captionIdx: 4, hashtagsIdx: 4, mediaIdx: null, targets: [{ accountKey: "tw_main", offsetHours: -6 / 60, status: "publishing" }] },
    { captionIdx: 14, hashtagsIdx: 14, mediaIdx: 1, targets: [{ accountKey: "fb_page", offsetHours: -1 / 60, status: "publishing" }] },

    // ----- Failed — varied, realistic error categories -----
    {
      captionIdx: 18,
      hashtagsIdx: null,
      mediaIdx: null,
      targets: [
        {
          accountKey: "li_reconnect",
          offsetHours: -1 * D + 9,
          status: "failed",
          attempts: [
            {
              offsetMinutesFromPublish: 1,
              httpStatus: 401,
              errorCode: "AUTH_EXPIRED",
              errorMessage: "Your LinkedIn session expired before this post could publish. Reconnect the account to resume publishing.",
              attemptNumber: 1,
            },
          ],
        },
      ],
    },
    {
      captionIdx: 5,
      hashtagsIdx: 5,
      mediaIdx: 2,
      targets: [
        {
          accountKey: "ig_main",
          offsetHours: -2 * D,
          status: "failed",
          attempts: [
            {
              offsetMinutesFromPublish: 1,
              httpStatus: 504,
              errorCode: "UPSTREAM_TIMEOUT",
              errorMessage: "The request to Instagram's API timed out before we received a response.",
              attemptNumber: 1,
            },
            {
              offsetMinutesFromPublish: 16,
              httpStatus: 504,
              errorCode: "UPSTREAM_TIMEOUT",
              errorMessage: "Retried and timed out again. We'll keep retrying automatically.",
              attemptNumber: 2,
            },
          ],
        },
      ],
    },
    {
      captionIdx: 15,
      hashtagsIdx: 15,
      mediaIdx: null,
      targets: [
        {
          accountKey: "tt_main",
          offsetHours: -3 * D,
          status: "failed",
          attempts: [
            {
              offsetMinutesFromPublish: 2,
              httpStatus: 422,
              errorCode: "CONTENT_REJECTED",
              errorMessage: "TikTok rejected this video: captions longer than 150 characters aren't supported for Business accounts on this plan.",
              attemptNumber: 1,
            },
          ],
        },
      ],
    },
    {
      captionIdx: 16,
      hashtagsIdx: 16,
      mediaIdx: 0,
      targets: [
        {
          accountKey: "fb_page",
          offsetHours: -1 * D + 15,
          status: "failed",
          attempts: [
            {
              offsetMinutesFromPublish: 1,
              httpStatus: 429,
              errorCode: "RATE_LIMITED",
              errorMessage: "Facebook's API rate limit was reached for this account. We'll automatically retry once the limit resets.",
              attemptNumber: 1,
            },
          ],
        },
      ],
    },
    {
      captionIdx: 3,
      hashtagsIdx: null,
      mediaIdx: 3,
      targets: [
        {
          accountKey: "yt_main",
          offsetHours: -5 * D,
          status: "failed",
          attempts: [
            {
              offsetMinutesFromPublish: 3,
              httpStatus: 400,
              errorCode: "MEDIA_PROCESSING_FAILED",
              errorMessage: "YouTube couldn't process the uploaded video file. Try re-uploading in MP4 format.",
              attemptNumber: 1,
            },
          ],
        },
      ],
    },

    // ----- needs_reconnect at the target level (flagged ahead of publish time) -----
    { captionIdx: 6, hashtagsIdx: 6, mediaIdx: null, targets: [{ accountKey: "li_reconnect", offsetHours: 1 * D, status: "needs_reconnect" }] },

    // ----- Upcoming (pending/queued), spread over the next ~2 weeks -----
    { captionIdx: 6, hashtagsIdx: 6, mediaIdx: 0, targets: [{ accountKey: "ig_main", offsetHours: 3 * H, status: "pending" }] },
    { captionIdx: 10, hashtagsIdx: 10, mediaIdx: null, targets: [{ accountKey: "li_connected", offsetHours: 22 * H, status: "queued" }] },
    {
      captionIdx: 11,
      hashtagsIdx: 11,
      mediaIdx: 1,
      targets: [
        { accountKey: "fb_page", offsetHours: 2 * D, status: "pending", platformCaptionOverride: "Poll time 👇 what's your biggest content bottleneck right now?" },
        { accountKey: "ig_creators", offsetHours: 2 * D + 1, status: "pending" },
      ],
    },
    { captionIdx: 12, hashtagsIdx: 12, mediaIdx: null, targets: [{ accountKey: "tw_main", offsetHours: 4 * D, status: "queued" }] },
    { captionIdx: 13, hashtagsIdx: 13, mediaIdx: 2, targets: [{ accountKey: "yt_main", offsetHours: 6 * D, status: "pending" }] },
    { captionIdx: 15, hashtagsIdx: 15, mediaIdx: null, targets: [{ accountKey: "pin_main", offsetHours: 8 * D, status: "pending" }] },
    { captionIdx: 16, hashtagsIdx: 16, mediaIdx: 3, targets: [{ accountKey: "ig_creators", offsetHours: 10 * D, status: "queued" }] },
    { captionIdx: 19, hashtagsIdx: 19, mediaIdx: null, targets: [{ accountKey: "fb_page", offsetHours: 13 * D, status: "pending" }] },

    // ----- Draft (no targets) -----
    { captionIdx: 7, hashtagsIdx: null, mediaIdx: null, targets: [] },
  ];
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const userId = parseUserId(process.argv.slice(2));
  const supabase = getSupabaseClient();

  // Deliberately no Auth-admin-API existence check here: the Auth service
  // (GoTrue) is a separate, occasionally-slow-or-unavailable service from
  // Postgres/PostgREST, and a hung request to it can wedge the shared HTTP
  // connection pool for every later request in this process (observed
  // directly while building this script). social_accounts.user_id and
  // scheduled_posts.user_id both carry a real FK on auth.users(id), so an
  // invalid --user id still fails loudly and clearly, just from Postgres
  // instead of from a friendlier pre-check.

  try {
    console.log("[seed] cleaning up any existing demo data for this user...");
    await cleanupUserData(userId);

    // ---------------------------------------------------------------
    // 1. social_accounts
    // ---------------------------------------------------------------
    console.log("[seed] inserting social_accounts...");
    const accountIdByKey = new Map<string, string>();
    const now = Date.now();

    for (const spec of ACCOUNT_SPECS) {
      const connectedAt = new Date(now - spec.daysAgoConnected * D * 60 * 60 * 1000);
      const tokenExpiresAt =
        spec.status === "needs_reconnect"
          ? new Date(now - 5 * D * 60 * 60 * 1000)
          : new Date(now + 30 * D * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from("social_accounts")
        .insert({
          user_id: userId,
          platform: spec.platform,
          platform_account_id: `demo-${spec.key}-${createHash("sha1").update(spec.key).digest("hex").slice(0, 8)}`,
          display_name: spec.displayName,
          avatar_url: `https://api.dicebear.com/9.x/avataaars/svg?seed=${spec.avatarSeed}`,
          access_token: encrypt(`seed-fake-token:${spec.platform}`),
          refresh_token: encrypt(`seed-fake-refresh:${spec.platform}`),
          token_expires_at: tokenExpiresAt.toISOString(),
          scopes: ["read", "write"],
          status: spec.status,
          connected_at: connectedAt.toISOString(),
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Failed to insert social_account ${spec.key}: ${error?.message}`);
      }
      accountIdByKey.set(spec.key, data.id as string);
    }
    console.log(`[seed] inserted ${accountIdByKey.size} social_accounts`);

    // ---------------------------------------------------------------
    // 2. Media uploads — real files in Supabase Storage.
    // ---------------------------------------------------------------
    console.log("[seed] uploading placeholder media to Supabase Storage...");
    const mediaFiles: { name: string; rgb: [number, number, number] }[] = [
      { name: "product-shot.png", rgb: [59, 130, 246] },
      { name: "team-photo.png", rgb: [16, 185, 129] },
      { name: "quote-card.png", rgb: [249, 115, 22] },
      { name: "dashboard-preview.png", rgb: [139, 92, 246] },
    ];
    const mediaUrls: string[] = [];
    for (const file of mediaFiles) {
      const png = makeSolidPng(600, 400, file.rgb);
      const uploaded = await uploadMedia(userId, file.name, "image/png", png);
      mediaUrls.push(uploaded.url);
    }
    console.log(`[seed] uploaded ${mediaUrls.length} media files`);

    // ---------------------------------------------------------------
    // 3. scheduled_posts + post_targets + publish_attempts
    // ---------------------------------------------------------------
    console.log("[seed] inserting scheduled_posts, post_targets, publish_attempts...");
    const postSpecs = buildPostSpecs();

    const counts = {
      posts: 0,
      targets: 0,
      attempts: 0,
      byStatus: {} as Record<PostTargetStatus, number>,
    };

    for (const post of postSpecs) {
      const hashtags = post.hashtagsIdx !== null ? HASHTAG_SETS[post.hashtagsIdx]! : null;
      const media = post.mediaIdx !== null ? [mediaUrls[post.mediaIdx]!] : null;
      const mediaType: MediaType | null = media ? "image" : null;

      const { data: postRow, error: postErr } = await supabase
        .from("scheduled_posts")
        .insert({
          user_id: userId,
          caption: CAPTIONS[post.captionIdx]!,
          hashtags,
          media_urls: media,
          media_type: mediaType,
        })
        .select("id")
        .single();

      if (postErr || !postRow) {
        throw new Error(`Failed to insert scheduled_post: ${postErr?.message}`);
      }
      counts.posts++;

      for (const target of post.targets) {
        const accountId = accountIdByKey.get(target.accountKey);
        if (!accountId) throw new Error(`Unknown account key in spec: ${target.accountKey}`);

        const publishAt = new Date(now + target.offsetHours * 60 * 60 * 1000);
        // For terminal states, backdate updated_at to match when this
        // "really" happened so time-windowed dashboard stats (e.g.
        // "published in the last 7 days") reflect the seeded spread
        // instead of the moment this script ran.
        const isTerminal = target.status === "published" || target.status === "failed";
        const updatedAt = isTerminal ? new Date(publishAt.getTime() + 60_000) : undefined;

        const insertRow: Record<string, unknown> = {
          scheduled_post_id: postRow.id,
          social_account_id: accountId,
          publish_at: publishAt.toISOString(),
          platform_caption_override: target.platformCaptionOverride ?? null,
          status: target.status,
          platform_post_id: target.platformPostId ?? null,
        };
        if (updatedAt) insertRow.updated_at = updatedAt.toISOString();

        const { data: targetRow, error: targetErr } = await supabase
          .from("post_targets")
          .insert(insertRow)
          .select("id")
          .single();

        if (targetErr || !targetRow) {
          throw new Error(`Failed to insert post_target: ${targetErr?.message}`);
        }
        counts.targets++;
        counts.byStatus[target.status] = (counts.byStatus[target.status] ?? 0) + 1;

        for (const attempt of target.attempts ?? []) {
          const attemptedAt = new Date(publishAt.getTime() + attempt.offsetMinutesFromPublish * 60 * 1000);
          const { error: attemptErr } = await supabase.from("publish_attempts").insert({
            post_target_id: targetRow.id,
            attempted_at: attemptedAt.toISOString(),
            http_status: attempt.httpStatus,
            error_code: attempt.errorCode,
            error_message: attempt.errorMessage,
            attempt_number: attempt.attemptNumber,
          });
          if (attemptErr) {
            throw new Error(`Failed to insert publish_attempt: ${attemptErr.message}`);
          }
          counts.attempts++;
        }

        // Give published targets a success attempt too, for a realistic log.
        if (target.status === "published") {
          const { error: attemptErr } = await supabase.from("publish_attempts").insert({
            post_target_id: targetRow.id,
            attempted_at: new Date(publishAt.getTime() + 30_000).toISOString(),
            http_status: 200,
            error_code: null,
            error_message: null,
            attempt_number: 1,
          });
          if (attemptErr) {
            throw new Error(`Failed to insert publish_attempt: ${attemptErr.message}`);
          }
          counts.attempts++;
        }
      }
    }

    // ---------------------------------------------------------------
    // Summary
    // ---------------------------------------------------------------
    console.log("\n[seed] SUCCESS — demo data summary:");
    console.log(`  social_accounts: ${accountIdByKey.size}`);
    for (const spec of ACCOUNT_SPECS) {
      console.log(`    - ${spec.displayName} (${spec.platform}): ${spec.status}`);
    }
    console.log(`  scheduled_posts: ${counts.posts}`);
    console.log(`  post_targets: ${counts.targets}`);
    for (const [status, n] of Object.entries(counts.byStatus)) {
      console.log(`    - ${status}: ${n}`);
    }
    console.log(`  publish_attempts: ${counts.attempts}`);
    console.log(`  media files uploaded: ${mediaUrls.length}`);
    console.log(`\n[seed] user id: ${userId}`);
    console.log("[seed] Done. Sign in as this user in the app to see everything populated.\n");

    process.exit(0);
  } catch (err) {
    console.error("[seed] FAILURE:", err instanceof Error ? err.message : err);
    console.error("[seed] cleaning up partial data...");
    try {
      await cleanupUserData(userId);
      console.error("[seed] cleanup complete — database is back to a clean (empty) state for this user.");
    } catch (cleanupErr) {
      console.error(
        "[seed] cleanup ALSO failed — manual intervention may be needed:",
        cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
      );
    }
    process.exit(1);
  }
}

main();
