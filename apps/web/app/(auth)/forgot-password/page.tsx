"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Input } from "../../../components/shared/Input";
import { createClient } from "../../../lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/sign-in` : undefined,
    });

    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold text-primary">Check your email</h1>
        <p className="mt-2 text-sm text-secondary">
          If an account exists for <span className="font-medium text-primary">{email}</span>,
          we&apos;ve sent a link to reset your password.
        </p>
        <Link
          href="/sign-in"
          className="mt-5 inline-block text-sm font-medium text-accent hover:text-accent-hover"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-primary">Reset your password</h1>
      <p className="mt-1 text-sm text-secondary">
        Enter your email and we&apos;ll send you a reset link.
      </p>

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
          {submitting ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-secondary">
        <Link href="/sign-in" className="font-medium text-accent hover:text-accent-hover">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
