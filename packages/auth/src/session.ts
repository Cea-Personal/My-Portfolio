import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface OwnerSession {
  user: User;
  ownerId: string;
}

export async function getOwnerSession(client: SupabaseClient): Promise<OwnerSession | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || !data.user.email_confirmed_at) return null;
  return { user: data.user, ownerId: data.user.id };
}

export async function requireOwnerSession(client: SupabaseClient): Promise<OwnerSession> {
  const session = await getOwnerSession(client);
  if (!session) {
    const error = new Error("Authentication required");
    error.name = "Unauthorized";
    throw error;
  }
  return session;
}
