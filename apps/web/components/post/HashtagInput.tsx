"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent, type ReactElement } from "react";

export interface HashtagInputProps {
  hashtags: string[];
  onChange: (hashtags: string[]) => void;
  maxTags?: number;
}

function normalize(raw: string): string {
  const trimmed = raw.trim().replace(/^#/, "");
  return trimmed ? `#${trimmed}` : "";
}

/** Chip-style tag input with live count validation. */
export function HashtagInput({ hashtags, onChange, maxTags = 30 }: HashtagInputProps): ReactElement {
  const [draft, setDraft] = useState("");
  const atLimit = hashtags.length >= maxTags;

  function commitDraft() {
    const tag = normalize(draft);
    setDraft("");
    if (!tag || atLimit || hashtags.includes(tag)) return;
    onChange([...hashtags, tag]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && hashtags.length > 0) {
      onChange(hashtags.slice(0, -1));
    }
  }

  function removeAt(index: number) {
    onChange(hashtags.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-primary">Hashtags</label>
        <span className={`text-xs ${atLimit ? "text-status-failed-text" : "text-secondary"}`}>
          {hashtags.length} / {maxTags}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-subtle bg-surface px-2.5 py-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        {hashtags.map((tag, index) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-pill bg-accent-muted-bg px-2.5 py-1 text-xs font-medium text-accent-muted-text"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => removeAt(index)}
              className="rounded-pill hover:opacity-70"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          disabled={atLimit}
          placeholder={atLimit ? "Limit reached" : "Add a hashtag..."}
          className="min-w-[8rem] flex-1 border-none bg-transparent px-1 py-0.5 text-sm text-primary placeholder:text-secondary focus:outline-none"
        />
      </div>
    </div>
  );
}
