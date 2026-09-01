"use client";

import { createBrowserClient } from "@supabase/ssr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export function PrivateWorkspaceGate({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const next = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;
    if (!url || !key) {
      router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
      return;
    }
    const client = createBrowserClient(url, key, { db: { schema: "app" } });
    void client.auth.getUser().then(({ error }) => {
      if (error) {
        router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
        return;
      }
      setIsAuthorized(true);
    });
  }, [pathname, router, searchParams]);

  if (isAuthorized) return children;
  return (
    <main className="private-workspace-check" aria-live="polite">
      Checking your private workspace session…
    </main>
  );
}
