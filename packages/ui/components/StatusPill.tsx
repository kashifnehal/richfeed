import type { ReactElement } from "react";

export type StatusPillStatus =
  | "scheduled"
  | "published"
  | "failed"
  | "needs-reconnect"
  | "queued"
  | "disconnected";

export interface StatusPillProps {
  status: StatusPillStatus;
  /** Defaults to a title-cased version of `status` (e.g. "needs-reconnect" -> "Needs reconnect"). */
  label?: string;
}

const STATUS_CLASSES: Record<StatusPillStatus, string> = {
  scheduled: "bg-status-scheduled-bg text-status-scheduled-text",
  published: "bg-status-published-bg text-status-published-text",
  failed: "bg-status-failed-bg text-status-failed-text",
  "needs-reconnect": "bg-status-needs-reconnect-bg text-status-needs-reconnect-text",
  queued: "bg-status-queued-bg text-status-queued-text",
  // No dedicated "disconnected" status color in tokens.css — reuses the
  // existing neutral subtle-2/secondary pair (same as a disabled/inactive
  // tile elsewhere in the UI) rather than adding a new hex value.
  disconnected: "bg-subtle-2 text-secondary",
};

function titleCase(status: string): string {
  const spaced = status.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function StatusPill({ status, label }: StatusPillProps): ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASSES[status]}`}
    >
      {label ?? titleCase(status)}
    </span>
  );
}
