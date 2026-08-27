import type { ReactElement } from "react";

export interface TopbarProps {
  title: string;
  hasAlert?: boolean;
}

export function Topbar({ title, hasAlert = false }: TopbarProps): ReactElement {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-subtle bg-app px-6">
      <h1 className="text-[19px] font-semibold text-primary">{title}</h1>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="relative text-nav-inactive transition-colors hover:text-primary"
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {hasAlert ? (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-pill bg-status-failed-text" />
          ) : null}
        </button>

        <span className="h-6 w-px bg-subtle" />

        <div className="flex items-center gap-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-accent-muted-bg text-xs font-bold text-accent-muted-text">
            WA
          </span>
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-secondary"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>
    </header>
  );
}
