import type { FastifyInstance } from "fastify";
import {
  createPostBodySchema,
  duplicatePostBodySchema,
  patchPostBodySchema,
  platformSchema,
  postTargetStatusSchema,
  type Platform,
  type PostTargetStatus,
} from "@richfeed/shared";
import { requireUser, sendUnauthorized } from "../lib/auth";
import {
  cancelAllTargetsForPost,
  cancelTarget,
  createScheduledPostWithTargets,
  duplicatePostToAccount,
  getScheduledPostDetail,
  listScheduledPostsWithTargets,
  listScheduledPostTargetsPage,
  rescheduleTarget,
  updateScheduledPostFields,
} from "../db/queries";

function parseStatusQuery(raw: unknown): PostTargetStatus[] | undefined {
  if (raw === undefined) return undefined;
  const values = Array.isArray(raw) ? raw : String(raw).split(",");
  const parsed = values.map((v) => postTargetStatusSchema.safeParse(v));
  const valid = parsed.filter((p): p is { success: true; data: PostTargetStatus } => p.success);
  return valid.length > 0 ? valid.map((p) => p.data) : undefined;
}

function parsePlatformQuery(raw: unknown): Platform[] | undefined {
  if (raw === undefined) return undefined;
  const values = Array.isArray(raw) ? raw : String(raw).split(",");
  const parsed = values.map((v) => platformSchema.safeParse(v));
  const valid = parsed.filter((p): p is { success: true; data: Platform } => p.success);
  return valid.length > 0 ? valid.map((p) => p.data) : undefined;
}

/** Parses a non-negative integer query param, or undefined if absent/invalid. */
function parseNonNegInt(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

export async function postsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/posts — list scheduled_posts with their post_targets. Supports
  // ?status=failed,queued and ?from=ISO&to=ISO date-range filters (applied
  // to post_targets.publish_at) for Calendar/Queue.
  //
  // When ?limit is present, the response is paged server-side at the
  // post_targets (queue-row) level: ?limit=20&offset=20&sort=asc|desc, and
  // the payload gains a `pagination: { limit, offset, total, hasMore }`
  // block. Without ?limit the full matching set is returned (Calendar).
  app.get<{
    Querystring: {
      status?: string;
      platform?: string;
      from?: string;
      to?: string;
      limit?: string;
      offset?: string;
      sort?: string;
    };
  }>("/api/posts", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const statuses = parseStatusQuery(request.query.status);
      const platforms = parsePlatformQuery(request.query.platform);
      const from = request.query.from;
      const to = request.query.to;

      const limit = parseNonNegInt(request.query.limit);
      if (limit !== undefined && limit > 0) {
        const offset = parseNonNegInt(request.query.offset) ?? 0;
        const sort = request.query.sort === "desc" ? "desc" : "asc";
        const page = await listScheduledPostTargetsPage(user.id, {
          statuses,
          platforms,
          from,
          to,
          limit,
          offset,
          sort,
        });
        return {
          posts: page.posts,
          pagination: { limit, offset, total: page.total, hasMore: page.hasMore },
        };
      }

      const posts = await listScheduledPostsWithTargets(user.id, { statuses, platforms, from, to });
      return { posts };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });

  // GET /api/posts/:id — full detail including publish_attempts per target.
  app.get<{ Params: { id: string } }>("/api/posts/:id", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const post = await getScheduledPostDetail(user.id, request.params.id);
      if (!post) {
        return reply.code(404).send({ error: "Post not found" });
      }
      return { post };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });

  // POST /api/posts — create a scheduled_posts row + its post_targets.
  // This is what Compose's "Save to queue" / "Save as draft" calls
  // (draft == targets: []).
  app.post("/api/posts", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const parsed = createPostBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
      }

      const post = await createScheduledPostWithTargets(user.id, parsed.data);
      return reply.code(201).send({ post });
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });

  // PATCH /api/posts/:id — edit fields, reschedule a target, or cancel
  // (one target or all non-published targets on the post).
  app.patch<{ Params: { id: string } }>("/api/posts/:id", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const parsed = patchPostBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
      }

      const body = parsed.data;

      if (body.action === "update") {
        const post = await updateScheduledPostFields(user.id, request.params.id, body);
        if (!post) return reply.code(404).send({ error: "Post not found" });
        return { post };
      }

      if (body.action === "reschedule") {
        const result = await rescheduleTarget(user.id, body.targetId, body.publishAt);
        if (!result.ok) {
          return reply
            .code(result.reason === "not_found" ? 404 : 409)
            .send({ error: result.reason === "not_found" ? "Target not found" : "Target already published" });
        }
      } else if (body.action === "cancel") {
        const result = await cancelTarget(user.id, body.targetId);
        if (!result.ok) {
          return reply
            .code(result.reason === "not_found" ? 404 : 409)
            .send({ error: result.reason === "not_found" ? "Target not found" : "Target already published" });
        }
      } else if (body.action === "cancel_all") {
        const ok = await cancelAllTargetsForPost(user.id, request.params.id);
        if (!ok) return reply.code(404).send({ error: "Post not found" });
      }

      const post = await getScheduledPostDetail(user.id, request.params.id);
      if (!post) return reply.code(404).send({ error: "Post not found" });
      return { post };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });

  // POST /api/posts/:id/duplicate — duplicate to another connected account.
  app.post<{ Params: { id: string } }>("/api/posts/:id/duplicate", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const parsed = duplicatePostBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
      }

      const post = await duplicatePostToAccount(
        user.id,
        request.params.id,
        parsed.data.socialAccountId,
        parsed.data.publishAt,
      );
      if (!post) {
        return reply.code(404).send({ error: "Post or target account not found" });
      }
      return reply.code(201).send({ post });
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });
}
