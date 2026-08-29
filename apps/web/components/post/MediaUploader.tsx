"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactElement } from "react";
import { useToast } from "../shared/Toast";
import { uploadMedia } from "../../lib/api";
import { kindFromMime, type MediaItem } from "../../lib/media";

export interface MediaUploaderProps {
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
}

/**
 * Drag-and-drop uploader with a reorderable thumbnail grid. Real uploads go to
 * Supabase Storage via POST /api/media; each item's kind (image/video) comes
 * from the browser File's type cross-checked against the content-type Storage
 * recorded, so the post's media_type is derived from what the files actually
 * are, not from how many there are.
 */
export function MediaUploader({ items, onChange }: MediaUploaderProps): ReactElement {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const settled = await Promise.all(
        Array.from(files).map(async (file) => {
          const browserKind = kindFromMime(file.type);
          const uploaded = await uploadMedia(file);
          const storageKind = kindFromMime(uploaded.contentType);
          return { name: file.name, url: uploaded.url, browserKind, storageKind };
        }),
      );

      const accepted: MediaItem[] = [];
      const rejected: string[] = [];
      for (const r of settled) {
        // Prefer what Storage will actually serve; fall back to the browser's
        // declared type. Reject anything that's neither image nor video, or
        // where the two sources disagree on that axis (can't trust the guess).
        const kind =
          r.storageKind && r.browserKind && r.storageKind !== r.browserKind
            ? null
            : (r.storageKind ?? r.browserKind);
        if (kind) accepted.push({ url: r.url, kind });
        else rejected.push(r.name);
      }

      if (accepted.length > 0) onChange([...items, ...accepted]);
      if (rejected.length > 0) {
        showToast(
          `Couldn't add ${rejected.join(", ")} — images and video only.`,
          "error",
        );
      }
    } catch {
      showToast("Couldn't upload media. Try again.", "error");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(e.dataTransfer.files);
  }

  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed px-4 py-8 text-center transition-colors ${
          dragOver ? "border-accent bg-accent-muted-bg" : "border-subtle bg-surface"
        }`}
      >
        {uploading ? (
          <Loader2 size={22} className="animate-spin text-secondary" />
        ) : (
          <ImagePlus size={22} className="text-secondary" />
        )}
        <p className="text-sm font-medium text-primary">
          {uploading ? "Uploading..." : "Drag and drop media, or click to browse"}
        </p>
        <p className="text-xs text-secondary">Images and video, up to 50MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {items.map((item, index) => (
            <div
              key={item.url}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) reorder(dragIndex, index);
                setDragIndex(null);
              }}
              className="group relative aspect-square overflow-hidden rounded-control border border-subtle-2 bg-surface"
            >
              {item.kind === "video" ? (
                <video src={item.url} className="h-full w-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- user-uploaded remote media, not worth Image config for a thumbnail grid
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                aria-label="Remove media"
                onClick={() => removeAt(index)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-surface text-secondary opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
