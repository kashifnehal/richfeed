import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { DashboardShell } from "../../components/shared/DashboardShell";
import { createClient } from "../../lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth — middleware.ts already redirects signed-out visitors,
  // this covers direct server-side renders/edge cases.
  if (!user) {
    redirect("/sign-in");
  }

  // Workspace name now lives in the `workspaces` table (RLS: owner-only).
  // Fall back to the legacy user_metadata value, then a generic default.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const workspaceName =
    workspace?.name ??
    (user.user_metadata?.workspace_name as string | undefined) ??
    "My Workspace";

  return (
    <DashboardShell email={user.email ?? ""} workspaceName={workspaceName}>
      {children}
    </DashboardShell>
  );
}
