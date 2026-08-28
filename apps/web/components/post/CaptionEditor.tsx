import type { ReactElement } from "react";

export interface CaptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}

/** Textarea with a live character counter. */
export function CaptionEditor({
  value,
  onChange,
  label = "Caption",
  placeholder = "Write your post...",
  maxLength = 2200,
  rows = 6,
}: CaptionEditorProps): ReactElement {
  const nearLimit = value.length > maxLength * 0.9;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-primary">{label}</label>
        <span className={`text-xs ${nearLimit ? "text-status-failed-text" : "text-secondary"}`}>
          {value.length} / {maxLength}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-control border border-subtle bg-surface px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
