import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@career-os/database";
import { getOwnerSession } from "@career-os/auth";
import { parsePublicEnv } from "@career-os/config";
import { PrivateWorkspaceGate } from "../../components/auth/private-workspace-gate";
import { WorkspaceNavigation } from "../../components/dashboard/workspace-navigation";

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
      <WorkspaceNavigation />
      {children}
    </PrivateWorkspaceGate>
  );
}
