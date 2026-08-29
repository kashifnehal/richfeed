import type { MediaType } from "@richfeed/shared";

/** A piece of attached media, tagged with the axis that decides media_type. */
export type MediaKind = "image" | "video";

export interface MediaItem {
  url: string;
  kind: MediaKind;
}

/** image/* -> "image", video/* -> "video", anything else -> null. */
export function kindFromMime(mime: string | null | undefined): MediaKind | null {
  if (!mime) return null;
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  return null;
}

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|mkv|ogv)$/i;

/**
 * Best-effort kind for media we only have a URL for (an already-saved post being
 * edited) — the upload path always has a real mimetype, this is the fallback.
 */
export function kindFromUrl(url: string): MediaKind {
  return VIDEO_EXT.test(url.split("?")[0] ?? url) ? "video" : "image";
}

export function itemsFromUrls(urls: string[]): MediaItem[] {
  return urls.map((url) => ({ url, kind: kindFromUrl(url) }));
}

export interface DerivedMediaType {
  mediaType: MediaType | null;
  /** Non-null when the selection can't map to a valid media_type. */
  error: string | null;
}

/**
 * Derives the post's media_type from the real kinds of the attached files:
 *   - a single image           -> "image"
 *   - multiple images          -> "carousel"
 *   - one video                -> "video"
 *   - images mixed with video  -> invalid
 *   - more than one video      -> invalid
 */
export function deriveMediaType(items: MediaItem[]): DerivedMediaType {
  if (items.length === 0) return { mediaType: null, error: null };

  const images = items.filter((i) => i.kind === "image").length;
  const videos = items.filter((i) => i.kind === "video").length;

  if (images > 0 && videos > 0) {
    return { mediaType: null, error: "A post can’t mix images and video — attach one or the other." };
  }
  if (videos > 1) {
    return { mediaType: null, error: "Only one video per post." };
  }
  if (videos === 1) return { mediaType: "video", error: null };
  if (images === 1) return { mediaType: "image", error: null };
  return { mediaType: "carousel", error: null };
}
