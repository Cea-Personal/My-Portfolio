import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface OwnerSession {
  user: User;
  ownerId: string;
}

export async function getOwnerSession(client: SupabaseClient): Promise<OwnerSession | null> {
  const { data, error } = await client.auth.getUser();
  // Supabase has already authenticated this user before issuing a session. Requiring a separate
  // email-confirmation flag here can reject valid owner accounts created directly in Supabase.
  if (error || !data.user) return null;
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
