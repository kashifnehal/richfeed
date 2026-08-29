/**
 * Zod schemas for the REST API contract between apps/web and apps/api.
 * Mirrors the unions in ./types.ts exactly — keep both in sync.
 */
import { z } from "zod";

export const platformSchema = z.enum([
  "instagram",
  "facebook",
  "twitter",
  "linkedin_personal",
  "linkedin_org",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
  "reddit",
]);

export const postTargetStatusSchema = z.enum([
  "pending",
  "publishing",
  "published",
  "failed",
  "needs_reconnect",
  "queued",
]);

export const accountStatusSchema = z.enum([
  "connected",
  "needs_reconnect",
  "limited",
]);

export const mediaTypeSchema = z.enum(["image", "video", "carousel"]);

// ---------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------

export const patchAccountBodySchema = z.object({
  action: z.literal("disconnect"),
});
export type PatchAccountBody = z.infer<typeof patchAccountBodySchema>;

// ---------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------

export const postTargetInputSchema = z.object({
  socialAccountId: z.string().uuid(),
  publishAt: z.string().datetime({ offset: true }),
  captionOverride: z.string().max(10000).nullable().optional(),
});
export type PostTargetInput = z.infer<typeof postTargetInputSchema>;

export const createPostBodySchema = z.object({
  caption: z.string().max(10000).nullable().optional(),
  hashtags: z.array(z.string().max(100)).max(50).nullable().optional(),
  mediaUrls: z.array(z.string().url()).max(20).nullable().optional(),
  mediaType: mediaTypeSchema.nullable().optional(),
  targets: z.array(postTargetInputSchema).max(50),
});
export type CreatePostBody = z.infer<typeof createPostBodySchema>;

export const listPostsQuerySchema = z.object({
  status: z
    .union([postTargetStatusSchema, z.array(postTargetStatusSchema)])
    .optional(),
  platform: z.union([platformSchema, z.array(platformSchema)]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export const patchPostBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    caption: z.string().max(10000).nullable().optional(),
    hashtags: z.array(z.string().max(100)).nullable().optional(),
    mediaUrls: z.array(z.string().url()).nullable().optional(),
    mediaType: mediaTypeSchema.nullable().optional(),
  }),
  z.object({
    action: z.literal("reschedule"),
    targetId: z.string().uuid(),
    publishAt: z.string().datetime({ offset: true }),
  }),
  z.object({
    action: z.literal("cancel"),
    targetId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("cancel_all"),
  }),
]);
export type PatchPostBody = z.infer<typeof patchPostBodySchema>;

export const duplicatePostBodySchema = z.object({
  socialAccountId: z.string().uuid(),
  publishAt: z.string().datetime({ offset: true }),
});
export type DuplicatePostBody = z.infer<typeof duplicatePostBodySchema>;

// ---------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------

export const patchWorkspaceBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export type PatchWorkspaceBody = z.infer<typeof patchWorkspaceBodySchema>;

// ---------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------

export const patchNotificationPreferencesBodySchema = z
  .object({
    notifyOnFailedPost: z.boolean().optional(),
    notifyOnNeedsReconnect: z.boolean().optional(),
  })
  .refine(
    (v) => v.notifyOnFailedPost !== undefined || v.notifyOnNeedsReconnect !== undefined,
    { message: "Provide at least one preference to update" },
  );
export type PatchNotificationPreferencesBody = z.infer<
  typeof patchNotificationPreferencesBodySchema
>;
