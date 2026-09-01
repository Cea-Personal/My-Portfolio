"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export function OwnerSignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    setIsSigningOut(true);
    if (url && key) {
      const client = createBrowserClient(url, key, { db: { schema: "app" } });
      await client.auth.signOut();
    }
    window.location.assign("/sign-in");
  }

  return (
    <button
      className="owner-sign-out"
      disabled={isSigningOut}
      onClick={() => void signOut()}
      type="button"
    >
      {isSigningOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
