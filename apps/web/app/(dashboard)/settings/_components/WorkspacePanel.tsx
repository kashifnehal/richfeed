"use client";

import type { WorkspaceDto } from "@richfeed/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Input } from "../../../../components/shared/Input";
import { useToast } from "../../../../components/shared/Toast";
import { apiFetch } from "../../../../lib/api";

/**
 * Workspace name now lives in the `workspaces` table (one per user, owner-only
 * RLS), read/written through GET/PATCH /api/workspace. It used to be stashed on
 * Supabase Auth user_metadata — that path is gone.
 */
export function WorkspacePanel(): ReactElement {
  const { showToast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ workspace: WorkspaceDto }>("/api/workspace")
      .then((res) => setName(res.workspace.name))
      .catch(() => showToast("Couldn't load your workspace.", "error"))
      .finally(() => setLoaded(true));
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/workspace", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      showToast("Workspace name saved.", "success");
      router.refresh();
    } catch {
      showToast("Couldn't save workspace name.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-primary">Workspace</h2>
      <Input
        label="Workspace name"
        name="workspace_name"
        value={name}
        disabled={!loaded}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="submit"
        disabled={saving || !loaded || name.trim().length === 0}
        className="self-start rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save workspace"}
      </button>
    </form>
  );
}
