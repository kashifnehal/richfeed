import { randomUUID } from "node:crypto";
import { getSupabaseClient } from "../db/supabase";

export const MEDIA_BUCKET = "media";

let bucketEnsured = false;

/**
 * Idempotently ensures the `media` Supabase Storage bucket exists (public
 * read, so PlatformPreviewCard/thumbnails can render via a plain URL).
 * Uploads go through this server with the service-role client, so no
 * storage RLS policy is required for authenticated writes.
 */
export async function ensureMediaBucket(): Promise<void> {
  if (bucketEnsured) return;

  const supabase = getSupabaseClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error(`[storage] failed to list buckets: ${listError.message}`);
    return;
  }

  if (!buckets?.some((b) => b.name === MEDIA_BUCKET)) {
    const { error: createError } = await supabase.storage.createBucket(MEDIA_BUCKET, {
      public: true,
      fileSizeLimit: "50MB",
    });
    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      console.error(`[storage] failed to create "${MEDIA_BUCKET}" bucket: ${createError.message}`);
      return;
    }
  }

  bucketEnsured = true;
}

export interface UploadedMedia {
  url: string;
  path: string;
}

export async function uploadMedia(
  userId: string,
  filename: string,
  contentType: string,
  data: Buffer,
): Promise<UploadedMedia> {
  await ensureMediaBucket();

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${randomUUID()}-${safeName}`;

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, data, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload media: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);

  return { url: publicUrlData.publicUrl, path };
}
