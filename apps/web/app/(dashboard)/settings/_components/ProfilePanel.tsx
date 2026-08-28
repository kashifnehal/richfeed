"use client";

import type { User } from "@supabase/supabase-js";
import { useState, type FormEvent, type ReactElement } from "react";
import { Input } from "../../../../components/shared/Input";
import { useToast } from "../../../../components/shared/Toast";
import { createClient } from "../../../../lib/supabase/client";

export function ProfilePanel({ user }: { user: User }): ReactElement {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState((user.user_metadata?.full_name as string) ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      email,
      data: { full_name: fullName },
    });
    setSavingProfile(false);
    showToast(
      error ? "Couldn't save profile changes." : "Profile updated. Check your inbox if you changed your email.",
      error ? "error" : "success",
    );
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters.", "error");
      return;
    }
    setSavingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (!error) setNewPassword("");
    showToast(error ? "Couldn't change password." : "Password changed.", error ? "error" : "success");
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={(e) => void handleSaveProfile(e)} className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-primary">Profile</h2>
        <Input
          label="Name"
          name="full_name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          disabled={savingProfile}
          className="self-start rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {savingProfile ? "Saving..." : "Save profile"}
        </button>
      </form>

      <form onSubmit={(e) => void handleChangePassword(e)} className="flex flex-col gap-4 border-t border-subtle-2 pt-6">
        <h2 className="text-sm font-semibold text-primary">Change password</h2>
        <Input
          label="New password"
          name="new_password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
        <button
          type="submit"
          disabled={savingPassword}
          className="self-start rounded-control border border-subtle px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-sidebar-hover disabled:opacity-60"
        >
          {savingPassword ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
