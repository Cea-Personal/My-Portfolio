import { contentHash } from "@career-os/documents";
import { createServiceSupabaseClient } from "@career-os/database/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret, getDriveOAuthConfig } from "@/lib/drive-oauth";
import {
  downloadDriveFile,
  driveTokenNeedsRefresh,
  getDriveStartPageToken,
  listDriveChanges,
  listDriveFiles,
  refreshDriveToken,
  type GoogleDriveChange,
  type StoredDriveToken
} from "@/lib/google-drive-client";
import { inngest } from "./client";

const MAX_SYNC_PAGES = 100;

function configuredClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? createServiceSupabaseClient(url, serviceRoleKey) : null;
}

function parseStoredToken(value: string): StoredDriveToken {
  const parsed = JSON.parse(value) as Partial<StoredDriveToken>;
  if (typeof parsed.access_token !== "string" || typeof parsed.obtained_at !== "string")
    throw new Error("DRIVE_CREDENTIAL_INVALID");
  return {
    access_token: parsed.access_token,
    refresh_token: typeof parsed.refresh_token === "string" ? parsed.refresh_token : null,
    expires_in: typeof parsed.expires_in === "number" ? parsed.expires_in : null,
    token_type: typeof parsed.token_type === "string" ? parsed.token_type : "Bearer",
    obtained_at: parsed.obtained_at
  };
}

function safeObjectName(name: string): string {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (cleaned || "document").slice(0, 160);
}

async function isCancelled(client: SupabaseClient, runId: string, ownerId: string) {
  const { data, error } = await client
    .schema("app")
    .from("ingestion_runs")
    .select("status")
    .eq("id", runId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data?.status === "cancelled";
}

async function tombstoneDocument(
  client: SupabaseClient,
  ownerId: string,
  connectionId: string,
  fileId: string,
  reason: "removed" | "permission"
) {
  const now = new Date().toISOString();
  const patch =
    reason === "removed"
      ? { availability: "unavailable", removed_at: now }
      : { availability: "unavailable", permission_lost_at: now };
  const { error } = await client
    .schema("app")
    .from("documents")
    .update(patch)
    .eq("owner_id", ownerId)
    .eq("integration_connection_id", connectionId)
    .eq("external_file_id", fileId);
  if (error) throw error;
}

async function persistDriveFile(
  client: SupabaseClient,
  ownerId: string,
  connectionId: string,
  runId: string,
  accessToken: string,
  change: GoogleDriveChange
): Promise<"changed" | "unchanged" | "unavailable"> {
  if (change.removed) {
    await tombstoneDocument(client, ownerId, connectionId, change.fileId, "removed");
    return "unavailable";
  }
  if (change.permissionLost || !change.file) {
    await tombstoneDocument(client, ownerId, connectionId, change.fileId, "permission");
    return "unavailable";
  }
  const file = change.file;
  const { data: existing, error: existingError } = await client
    .schema("app")
    .from("documents")
    .select("id,last_seen_version")
    .eq("owner_id", ownerId)
    .eq("integration_connection_id", connectionId)
    .eq("external_file_id", file.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.last_seen_version === file.version) return "unchanged";

  let downloaded;
  try {
    downloaded = await downloadDriveFile(accessToken, file);
  } catch (error) {
    if (error instanceof Error && error.message === "DRIVE_PERMISSION_LOST") {
      await tombstoneDocument(client, ownerId, connectionId, file.id, "permission");
      return "unavailable";
    }
    throw error;
  }
  const hash = contentHash(downloaded.bytes);
  const { data: document, error: documentError } = await client
    .schema("app")
    .from("documents")
    .upsert(
      {
        owner_id: ownerId,
        integration_connection_id: connectionId,
        external_file_id: file.id,
        name: file.name,
        source_mime: file.mimeType,
        availability: "available",
        last_seen_version: file.version,
        removed_at: null,
        permission_lost_at: null
      },
      { onConflict: "integration_connection_id,external_file_id" }
    )
    .select("id")
    .single();
  if (documentError || !document) throw documentError ?? new Error("DRIVE_DOCUMENT_PERSIST_FAILED");

  const { data: prior, error: priorError } = await client
    .schema("app")
    .from("document_versions")
    .select("id,internal_sha256")
    .eq("document_id", document.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorError) throw priorError;
  if (prior?.internal_sha256 === hash) return "unchanged";

  const objectPath = `${ownerId}/drive/${document.id}/${hash}/${safeObjectName(downloaded.filename)}`;
  const { error: storageError } = await client.storage
    .from("private-documents")
    .upload(objectPath, downloaded.bytes, {
      contentType: downloaded.mimeType,
      cacheControl: "31536000",
      upsert: true
    });
  if (storageError) throw storageError;

  const { data: version, error: versionError } = await client
    .schema("app")
    .from("document_versions")
    .upsert(
      {
        document_id: document.id,
        provider_version: file.version,
        export_mime: downloaded.mimeType,
        provider_checksum: file.md5Checksum ?? null,
        internal_sha256: hash,
        modified_at: file.modifiedTime ?? null,
        download_status: "downloaded",
        prior_version_id: prior?.id ?? null,
        storage_object_path: objectPath
      },
      { onConflict: "document_id,internal_sha256" }
    )
    .select("id")
    .single();
  if (versionError || !version)
    throw versionError ?? new Error("DRIVE_DOCUMENT_VERSION_PERSIST_FAILED");

  const { error: itemError } = await client
    .schema("app")
    .from("ingestion_items")
    .upsert(
      {
        run_id: runId,
        document_id: document.id,
        document_version_id: version.id,
        stage: "downloaded",
        status: "completed",
        attempts: 1,
        parser_metrics: { bytes: downloaded.bytes.byteLength, mimeType: downloaded.mimeType },
        finished_at: new Date().toISOString()
      },
      { onConflict: "run_id,document_id,document_version_id" }
    );
  if (itemError) throw itemError;
  await inngest.send({
    name: "career/document.changed.v1",
    id: `${ownerId}:${document.id}:${hash}`,
    data: {
      schemaVersion: 1,
      ownerId,
      resourceType: "document",
      resourceId: document.id,
      operationKey: `drive:${connectionId}:${file.id}:${file.version}`,
      requestedBy: "workflow",
      metadata: { documentVersionId: version.id, ingestionRunId: runId }
    }
  });
  return "changed";
}

export const driveSync = inngest.createFunction(
  {
    id: "drive-sync",
    retries: 3,
    concurrency: [{ limit: 1, key: "event.data.ownerId" }],
    triggers: [{ event: "career/drive.sync.requested.v1" }]
  },
  async ({ event, step }) => {
    const ownerId = typeof event.data.ownerId === "string" ? event.data.ownerId : null;
    const runId = typeof event.data.runId === "string" ? event.data.runId : null;
    const client = configuredClient();
    if (!ownerId || !runId) return { status: "failed" as const, reason: "INVALID_SYNC_EVENT" };
    if (!client)
      return { status: "deferred" as const, reason: "SERVICE_CONFIGURATION_MISSING", runId };
    const oauth = getDriveOAuthConfig();
    if (!oauth)
      return { status: "deferred" as const, reason: "DRIVE_CONFIGURATION_MISSING", runId };

    const { data: run, error: runError } = await client
      .schema("app")
      .from("ingestion_runs")
      .select("connection_id,status")
      .eq("id", runId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (runError) throw runError;
    if (!run?.connection_id)
      return { status: "failed" as const, reason: "DRIVE_CONNECTION_REQUIRED" };
    if (run.status === "cancelled") return { status: "cancelled" as const, runId };

    const connectionId = run.connection_id as string;
    const { error: startError } = await client
      .schema("app")
      .from("ingestion_runs")
      .update({ status: "running", started_at: new Date().toISOString(), error_summary: null })
      .eq("id", runId)
      .eq("owner_id", ownerId);
    if (startError) throw startError;

    try {
      const result = await step.run("reconcile-drive", async () => {
        const { data: connection, error: connectionError } = await client
          .schema("app")
          .from("integration_connections")
          .select("id,status,cursor")
          .eq("id", connectionId)
          .eq("owner_id", ownerId)
          .eq("provider", "drive")
          .maybeSingle();
        if (connectionError) throw connectionError;
        if (!connection || connection.status !== "active")
          throw new Error("DRIVE_RECONNECT_REQUIRED");
        const { data: credential, error: credentialError } = await client
          .schema("app")
          .from("integration_oauth_credentials")
          .select("ciphertext")
          .eq("connection_id", connectionId)
          .maybeSingle();
        if (credentialError || !credential)
          throw credentialError ?? new Error("DRIVE_RECONNECT_REQUIRED");
        let token = parseStoredToken(decryptSecret(credential.ciphertext, oauth.encryptionKey));
        if (driveTokenNeedsRefresh(token)) {
          token = await refreshDriveToken(token, oauth.clientId, oauth.clientSecret);
          const { error } = await client
            .schema("app")
            .from("integration_oauth_credentials")
            .update({
              ciphertext: encryptSecret(JSON.stringify(token), oauth.encryptionKey),
              rotated_at: new Date().toISOString()
            })
            .eq("connection_id", connectionId);
          if (error) throw error;
        }

        const changes: GoogleDriveChange[] = [];
        let nextCursor = typeof connection.cursor === "string" ? connection.cursor : "";
        if (connection.cursor) {
          let pageToken = connection.cursor as string;
          for (let page = 0; page < MAX_SYNC_PAGES; page += 1) {
            if (await isCancelled(client, runId, ownerId))
              return { status: "cancelled" as const, changed: 0, unavailable: 0, unchanged: 0 };
            const pageResult = await listDriveChanges(token.access_token, pageToken);
            changes.push(...pageResult.changes);
            if (!pageResult.nextPageToken) {
              nextCursor = pageResult.newStartPageToken ?? pageToken;
              break;
            }
            pageToken = pageResult.nextPageToken;
            if (page === MAX_SYNC_PAGES - 1) throw new Error("DRIVE_PAGE_LIMIT_EXCEEDED");
          }
        } else {
          nextCursor = await getDriveStartPageToken(token.access_token);
          let pageToken: string | undefined;
          for (let page = 0; page < MAX_SYNC_PAGES; page += 1) {
            if (await isCancelled(client, runId, ownerId))
              return { status: "cancelled" as const, changed: 0, unavailable: 0, unchanged: 0 };
            const pageResult = await listDriveFiles(token.access_token, pageToken);
            changes.push(...pageResult.changes);
            pageToken = pageResult.nextPageToken;
            if (!pageToken) break;
            if (page === MAX_SYNC_PAGES - 1) throw new Error("DRIVE_PAGE_LIMIT_EXCEEDED");
          }
        }

        const counts = { changed: 0, unavailable: 0, unchanged: 0 };
        const permanentErrors: string[] = [];
        for (const change of changes) {
          if (await isCancelled(client, runId, ownerId))
            return { status: "cancelled" as const, ...counts };
          try {
            const outcome = await persistDriveFile(
              client,
              ownerId,
              connectionId,
              runId,
              token.access_token,
              change
            );
            counts[outcome] += 1;
          } catch (error) {
            const code = error instanceof Error ? error.message : "DRIVE_FILE_FAILED";
            if (code === "DRIVE_RETRYABLE_ERROR" || code === "DRIVE_TOKEN_REJECTED") throw error;
            permanentErrors.push(`${change.fileId}:${code}`.slice(0, 180));
          }
        }
        const { error: cursorError } = await client
          .schema("app")
          .from("integration_connections")
          .update({
            cursor: nextCursor,
            cursor_version: "drive-v3",
            last_success_at: new Date().toISOString(),
            last_error_code: permanentErrors.length ? "PARTIAL_FILE_FAILURE" : null
          })
          .eq("id", connectionId)
          .eq("owner_id", ownerId);
        if (cursorError) throw cursorError;
        return {
          status: permanentErrors.length ? ("partial" as const) : ("completed" as const),
          ...counts,
          errors: permanentErrors.slice(0, 10)
        };
      });

      const { error: finishError } = await client
        .schema("app")
        .from("ingestion_runs")
        .update({
          status: result.status,
          document_count: result.changed,
          finished_at: new Date().toISOString(),
          error_summary:
            "errors" in result && result.errors?.length
              ? result.errors.join("; ").slice(0, 500)
              : null
        })
        .eq("id", runId)
        .eq("owner_id", ownerId);
      if (finishError) throw finishError;
      return { ...result, runId, resumable: true };
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 120) : "DRIVE_SYNC_FAILED";
      await client
        .schema("app")
        .from("ingestion_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error_summary: code })
        .eq("id", runId)
        .eq("owner_id", ownerId)
        .neq("status", "cancelled");
      await client
        .schema("app")
        .from("integration_connections")
        .update({
          status: code === "DRIVE_RECONNECT_REQUIRED" ? "error" : "active",
          last_error_code: code
        })
        .eq("id", connectionId)
        .eq("owner_id", ownerId);
      throw error;
    }
  }
);
