"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { Input } from "../../../../components/shared/Input";
import { useToast } from "../../../../components/shared/Toast";
import { createClient } from "../../../../lib/supabase/client";

/**
 * The Step 2 schema has no `workspaces` table yet (single-tenant-shaped for
 * now, multi-tenant-ready later), so the workspace name is stored on the
 * user's own Supabase Auth metadata rather than a separate row. Swap this
 * for a real workspaces table once one exists.
 */
export function WorkspacePanel({ user }: { user: User }): ReactElement {
  const { showToast } = useToast();
  const router = useRouter();
  const [name, setName] = useState((user.user_metadata?.workspace_name as string) ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { workspace_name: name } });
    setSaving(false);
    showToast(error ? "Couldn't save workspace name." : "Workspace name saved.", error ? "error" : "success");
    if (!error) router.refresh();
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-primary">Workspace</h2>
      <Input
        label="Workspace name"
        name="workspace_name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save workspace"}
      </button>
    </form>
  );
}
