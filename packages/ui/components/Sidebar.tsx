import type { ReactElement, SVGProps } from "react";

export type SidebarActive =
  | "dashboard"
  | "calendar"
  | "queue"
  | "accounts"
  | "settings";

export interface SidebarProps {
  active: SidebarActive;
}

function Icon({ children, ...props }: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const DashboardIcon = (): ReactElement => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

const CalendarIcon = (): ReactElement => (
  <Icon>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 2v4" />
    <path d="M16 2v4" />
  </Icon>
);

const QueueIcon = (): ReactElement => (
  <Icon>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h10" />
  </Icon>
);

const AccountsIcon = (): ReactElement => (
  <Icon>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 20c0-3.3 2.6-5.75 5.5-5.75S14.5 16.7 14.5 20" />
    <path d="M16.5 4.2a3 3 0 0 1 0 7.6" />
    <path d="M20.5 20c0-2.6-1.4-4.8-3.6-5.6" />
  </Icon>
);

const SettingsIcon = (): ReactElement => (
  <Icon>
    <circle cx="12" cy="12" r="3.25" />
    <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M19.8 7.5l-1.9 1.1M6.1 15.4l-1.9 1.1" />
  </Icon>
);

type NavEntry = {
  key: SidebarActive;
  label: string;
  href: string;
  Icon: () => ReactElement;
};

const NAV_ENTRIES: NavEntry[] = [
  { key: "dashboard", label: "Dashboard", href: "/", Icon: DashboardIcon },
  { key: "calendar", label: "Calendar", href: "/calendar", Icon: CalendarIcon },
  { key: "queue", label: "Queue", href: "/queue", Icon: QueueIcon },
  { key: "accounts", label: "Accounts", href: "/accounts", Icon: AccountsIcon },
  { key: "settings", label: "Settings", href: "/settings", Icon: SettingsIcon },
];

export function Sidebar({ active }: SidebarProps): ReactElement {
  return (
    <aside className="flex h-full min-h-screen w-[240px] shrink-0 flex-col bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-control bg-accent text-on-accent">
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h16M4 17h11" />
          </svg>
        </span>
        <span className="text-sm font-extrabold tracking-tight text-primary">
          The Social Queue
        </span>
      </div>

      <div className="px-3 pb-4">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-control bg-accent px-3 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New post
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ENTRIES.map(({ key, label, href, Icon: EntryIcon }) => {
          const isActive = key === active;
          return (
            <a
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent-muted-bg text-accent-muted-text"
                  : "text-nav-inactive hover:bg-sidebar-hover"
              }`}
            >
              <EntryIcon />
              {label}
            </a>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 border-t border-subtle px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-accent-muted-bg text-xs font-bold text-accent-muted-text">
          WA
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-primary">Workspace Admin</span>
          <span className="text-xs text-secondary">BBR Marketing</span>
        </span>
      </div>
    </aside>
  );
}
