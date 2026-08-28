"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { createClient } from "../../lib/supabase/client";

export interface UserMenuProps {
  email: string;
  initials: string;
}

/** Topbar user avatar/menu: Settings + Sign out. */
export function UserMenu({ email, initials }: UserMenuProps): ReactElement {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="flex items-center gap-1 rounded-control p-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-accent-muted-bg text-xs font-bold text-accent-muted-text">
            {initials}
          </span>
          <ChevronDown size={16} className="text-secondary" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-56 rounded-card border border-subtle-2 bg-surface p-1.5 shadow-lg"
        >
          <p className="truncate px-2.5 py-2 text-xs text-secondary">{email}</p>
          <DropdownMenu.Separator className="my-1 h-px bg-subtle" />
          <DropdownMenu.Item asChild>
            <Link
              href="/settings"
              className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm text-primary outline-none transition-colors hover:bg-sidebar-hover"
            >
              <Settings size={16} />
              Settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => void handleSignOut()}
            className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm text-primary outline-none transition-colors hover:bg-sidebar-hover"
          >
            <LogOut size={16} />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
