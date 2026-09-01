import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@career-os/database";
import { getOwnerSession } from "@career-os/auth";
import { parsePublicEnv } from "@career-os/config";

const links = [
  ["Overview", "/dashboard"],
  ["Career Brain", "/career-brain"],
  ["Jobs", "/jobs"],
  ["Documents", "/documents"],
  ["Blog", "/blog"],
  ["Analytics", "/analytics"],
  ["Settings", "/settings/data"]
] as const;

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const env = parsePublicEnv();
  const session = await getOwnerSession(
    createServerSupabaseClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      await cookies()
    )
  );
  if (!session) redirect("/sign-in?next=/dashboard");
  return (
    <>
      <nav aria-label="Private workspace">
        <a href="/dashboard">Basil Ogbonna · Workspace</a>
        {links.slice(1).map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
        <a href="/">Public portfolio</a>
      </nav>
      {children}
    </>
  );
}
