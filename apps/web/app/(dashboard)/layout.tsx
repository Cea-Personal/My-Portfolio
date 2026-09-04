import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@career-os/database";
import { getOwnerSession } from "@career-os/auth";
import { parsePublicEnv } from "@career-os/config";
import { PrivateWorkspaceGate } from "../../components/auth/private-workspace-gate";
import { OwnerSignOutButton } from "../../components/auth/owner-sign-out-button";

const links = [
  ["Career Brain", "/career-brain"],
  ["Jobs", "/jobs"],
  ["Application Kit", "/applications"],
  ["Interview Kit", "/interviews"],
  ["Journals", "/journal"],
  ["Blog", "/blogs"],
  ["Settings", "/settings"],
  ["Portfolio", "/"]
] as const;

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const env = parsePublicEnv();
  const client = createServerSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    await cookies()
  );
  const { data: identity } = await client.auth.getUser();
  if (!identity.user) redirect("/sign-in?next=/dashboard");
  const session = await getOwnerSession(client);
  if (!session) redirect("/sign-in?error=not_authorized&next=/dashboard");
  return (
    <PrivateWorkspaceGate>
      <nav aria-label="Private workspace">
        <a href="/dashboard">Basil Ogbonna · Workspace</a>
        {links.map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
        <OwnerSignOutButton />
      </nav>
      {children}
    </PrivateWorkspaceGate>
  );
}
