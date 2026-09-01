import { OwnerSignInForm } from "../../../components/auth/owner-sign-in-form";

export default function SignInPage() {
  return (
    <main className="owner-sign-in-page">
      <section aria-labelledby="owner-sign-in-title">
        <p>Private workspace</p>
        <h1 id="owner-sign-in-title">Welcome back, Basil.</h1>
        <span>Use your Supabase owner account to manage the systems behind the portfolio.</span>
        <OwnerSignInForm />
      </section>
    </main>
  );
}
