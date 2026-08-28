import type { FastifyInstance } from "fastify";
import { requireUser, sendUnauthorized } from "../lib/auth";
import { uploadMedia } from "../lib/storage";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB, matches the bucket's fileSizeLimit.

/**
 * POST /api/media — multipart file upload for the Compose page's
 * MediaUploader. Not in the spec's literal route list, but required so
 * MediaUploader can do a "real upload to Supabase Storage" as specced.
 * Uploads go through the service-role client server-side rather than
 * directly from the browser, so no storage RLS policy is needed and the
 * same session-verification pattern as every other route applies.
 */
export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/media", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const file = await request.file({ limits: { fileSize: MAX_BYTES } });

      if (!file) {
        return reply.code(400).send({ error: "No file uploaded" });
      }

      const buffer = await file.toBuffer();
      const uploaded = await uploadMedia(
        user.id,
        file.filename,
        file.mimetype || "application/octet-stream",
        buffer,
      );

      return reply.code(201).send(uploaded);
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });
}
