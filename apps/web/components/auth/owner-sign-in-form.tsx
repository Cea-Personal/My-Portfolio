"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function OwnerSignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "callback_failed"
      ? "The sign-in link was invalid or expired."
      : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestedNext = searchParams.get("next");
  const next = requestedNext?.startsWith("/") ? requestedNext : "/dashboard";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("Supabase is not configured. Add the public URL and anon key to .env.local.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const client = createBrowserClient(url, key, { db: { schema: "app" } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }
    window.location.assign(next);
  }

  return (
    <form
      className="owner-sign-in-form"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <label htmlFor="owner-email">
        Email
        <input
          id="owner-email"
          autoComplete="email"
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          required
          type="email"
          value={email}
        />
      </label>
      <label htmlFor="owner-password">
        Password
        <input
          id="owner-password"
          autoComplete="current-password"
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          required
          type="password"
          value={password}
        />
      </label>
      {error ? (
        <p className="owner-sign-in-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Enter private workspace"}
      </button>
    </form>
  );
}
