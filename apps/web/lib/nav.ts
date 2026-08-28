import type { SidebarActive } from "@richfeed/ui";

export interface NavMeta {
  active?: SidebarActive;
  title: string;
}

/** Maps a pathname to the Sidebar's active entry + the Topbar title. */
export function getNavMeta(pathname: string): NavMeta {
  if (pathname.startsWith("/dashboard")) return { active: "dashboard", title: "Dashboard" };
  if (pathname.startsWith("/calendar")) return { active: "calendar", title: "Calendar" };
  if (pathname.startsWith("/queue")) return { active: "queue", title: "Queue" };
  if (pathname.startsWith("/accounts")) return { active: "accounts", title: "Accounts" };
  if (pathname.startsWith("/settings")) return { active: "settings", title: "Settings" };
  if (pathname === "/posts/new") return { title: "New post" };
  if (pathname.startsWith("/posts/")) return { title: "Edit post" };
  return { title: "RichFeed" };
}
