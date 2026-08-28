"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactElement } from "react";
import { useToast } from "../shared/Toast";
import { uploadMedia } from "../../lib/api";

export interface MediaUploaderProps {
  mediaUrls: string[];
  onChange: (urls: string[]) => void;
}

/** Drag-and-drop uploader with a reorderable thumbnail grid. Real uploads go to Supabase Storage via POST /api/media. */
export function MediaUploader({ mediaUrls, onChange }: MediaUploaderProps): ReactElement {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((file) => uploadMedia(file)));
      onChange([...mediaUrls, ...uploaded.map((u) => u.url)]);
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
    onChange(mediaUrls.filter((_, i) => i !== index));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...mediaUrls];
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

      {mediaUrls.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {mediaUrls.map((url, index) => (
            <div
              key={url}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) reorder(dragIndex, index);
                setDragIndex(null);
              }}
              className="group relative aspect-square overflow-hidden rounded-control border border-subtle-2 bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded remote media, not worth Image config for a thumbnail grid */}
              <img src={url} alt="" className="h-full w-full object-cover" />
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
