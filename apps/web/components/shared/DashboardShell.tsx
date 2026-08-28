"use client";

import { Sidebar, Topbar } from "@richfeed/ui";
import { usePathname } from "next/navigation";
import { useState, type ReactElement, type ReactNode } from "react";
import { getNavMeta } from "../../lib/nav";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

export interface DashboardShellProps {
  children: ReactNode;
  email: string;
  workspaceName: string;
}

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

export function DashboardShell({ children, email, workspaceName }: DashboardShellProps): ReactElement {
  const pathname = usePathname();
  const { active, title } = getNavMeta(pathname);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar
        active={active}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        workspaceName={workspaceName}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title={title}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          right={
            <>
              <NotificationBell />
              <span className="h-6 w-px bg-subtle" />
              <UserMenu email={email} initials={initialsFromEmail(email)} />
            </>
          }
        />

        <main className="flex-1 bg-app p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
