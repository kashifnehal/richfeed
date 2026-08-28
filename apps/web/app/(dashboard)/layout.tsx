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

  const workspaceName =
    (user.user_metadata?.workspace_name as string | undefined) ?? "My Workspace";

  return (
    <DashboardShell email={user.email ?? ""} workspaceName={workspaceName}>
      {children}
    </DashboardShell>
  );
}
