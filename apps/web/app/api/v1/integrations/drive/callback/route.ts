import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@career-os/database";
import {
  decryptSecret,
  encryptSecret,
  exchangeDriveAuthorizationCode,
  getDriveOAuthConfig,
  stateHash
} from "@/lib/drive-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const config = getDriveOAuthConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!code || !state || !config || !serviceRoleKey || !supabaseUrl) {
    return NextResponse.redirect(new URL("/documents?drive=failed", url));
  }
  const client = createServiceSupabaseClient(supabaseUrl, serviceRoleKey);
  const { data: pending, error: pendingError } = await client
    .schema("app")
    .from("drive_oauth_states")
    .select("id,owner_id,verifier_ciphertext,expires_at")
    .eq("state_hash", stateHash(state))
    .is("used_at", null)
    .maybeSingle();
  if (pendingError || !pending || new Date(pending.expires_at).getTime() <= Date.now()) {
    return NextResponse.redirect(new URL("/documents?drive=failed", url));
  }
  try {
    const exchanged = await exchangeDriveAuthorizationCode(
      config,
      code,
      decryptSecret(pending.verifier_ciphertext, config.encryptionKey)
    );
    const { data: connection, error: connectionError } = await client
      .schema("app")
      .from("integration_connections")
      .upsert(
        {
          owner_id: pending.owner_id,
          provider: "drive",
          connection_type: "oauth",
          external_account_id: exchanged.externalAccountId,
          status: "active",
          scopes: exchanged.scopes,
          secret_ref: `secret:/app/drive/${pending.id}`
        },
        { onConflict: "owner_id,provider,external_account_id" }
      )
      .select("id")
      .single();
    if (connectionError || !connection)
      throw connectionError ?? new Error("DRIVE_CONNECTION_FAILED");
    const { error: credentialError } = await client
      .schema("app")
      .from("integration_oauth_credentials")
      .upsert(
        {
          connection_id: connection.id,
          ciphertext: encryptSecret(exchanged.tokenPayload, config.encryptionKey)
        },
        { onConflict: "connection_id" }
      );
    if (credentialError) throw credentialError;
    await client
      .schema("app")
      .from("drive_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", pending.id);
    return NextResponse.redirect(new URL("/documents?drive=connected", url));
  } catch {
    return NextResponse.redirect(new URL("/documents?drive=failed", url));
  }
}
