"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Input } from "../../../components/shared/Input";
import { createClient } from "../../../lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-primary">Sign in</h1>
      <p className="mt-1 text-sm text-secondary">Welcome back to The Social Queue.</p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="-mt-2 text-right">
          <Link href="/forgot-password" className="text-xs font-medium text-accent hover:text-accent-hover">
            Forgot password?
          </Link>
        </div>

        {error ? (
          <p className="rounded-control bg-status-failed-bg px-3 py-2 text-sm text-status-failed-text">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 w-full rounded-control bg-accent px-3.5 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-medium text-accent hover:text-accent-hover">
          Sign up
        </Link>
      </p>
    </div>
  );
}
