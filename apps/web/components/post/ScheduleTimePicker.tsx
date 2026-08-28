import type { ReactElement } from "react";

export interface ScheduleTimePickerProps {
  /** ISO datetime string (or ""), always shown as the exact timestamp the user picked. */
  value: string;
  onChange: (isoValue: string) => void;
  label?: string;
}

function toLocalInputValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Exact-timestamp picker. Server-side jitter (see apps/api/src/queue/scheduler.ts)
 * is a pure execution-time detail — the user always sees and picks their
 * exact chosen time here, never anything jittered.
 */
export function ScheduleTimePicker({
  value,
  onChange,
  label = "Publish at",
}: ScheduleTimePickerProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <label className="text-sm font-medium text-primary">{label}</label> : null}
      <input
        type="datetime-local"
        value={toLocalInputValue(value)}
        onChange={(e) => {
          const local = e.target.value;
          onChange(local ? new Date(local).toISOString() : "");
        }}
        className="rounded-control border border-subtle bg-surface px-3.5 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
