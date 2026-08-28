import type { ReactElement, ReactNode } from "react";

export interface TopbarProps {
  title: string;
  /** Interactive content (NotificationBell, user menu, ...) rendered on the right. */
  right?: ReactNode;
  /** Hamburger button shown below `lg`, toggling the Sidebar drawer. */
  onOpenMobileNav?: () => void;
}

export function Topbar({ title, right, onOpenMobileNav }: TopbarProps): ReactElement {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-subtle bg-app px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {onOpenMobileNav ? (
          <button
            type="button"
            aria-label="Open navigation"
            onClick={onOpenMobileNav}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-control text-nav-inactive transition-colors hover:bg-sidebar-hover hover:text-primary lg:hidden"
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
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        ) : null}
        <h1 className="truncate text-[19px] font-semibold text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-4">{right}</div>
    </header>
  );
}
