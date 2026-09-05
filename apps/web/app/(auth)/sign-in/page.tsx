import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@career-os/auth";
import { createServerSupabaseClient } from "@career-os/database";
import { parsePublicEnv } from "@career-os/config";
import { OwnerSignInForm } from "../../../components/auth/owner-sign-in-form";

export default async function SignInPage() {
  const env = parsePublicEnv();
  const client = createServerSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    await cookies()
  );
  if (await getOwnerSession(client)) redirect("/dashboard");

  return (
    <main className="owner-sign-in-page">
      <section aria-labelledby="owner-sign-in-title">
        <a className="owner-sign-in-back" href="/">
          ← Back to Basil&apos;s portfolio
        </a>
        <p>Private workspace</p>
        <h1 id="owner-sign-in-title">Welcome back, Basil.</h1>
        <span>Use your Supabase owner account to manage the systems behind the portfolio.</span>
        <Suspense fallback={<p>Preparing secure sign-in…</p>}>
          <OwnerSignInForm />
        </Suspense>
      </section>
    </main>
  );
}
