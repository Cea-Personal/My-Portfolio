import { apiResponse } from "@/lib/api/response";
import { inngest } from "@/inngest/client";
import { createServiceSupabaseClient } from "@career-os/database";

export async function POST(request: Request) {
  const state = request.headers.get("x-goog-resource-state");
  const channelId = request.headers.get("x-goog-channel-id");
  if (!channelId || !state || !["sync", "change", "update"].includes(state))
    return apiResponse({ code: "INVALID_DRIVE_WEBHOOK" }, request, 400);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return apiResponse({ accepted: true, deferred: true }, request, 202);
  const client = createServiceSupabaseClient(url, serviceRoleKey);
  const { data: connection, error } = await client
    .schema("app")
    .from("integration_connections")
    .select("id,owner_id")
    .eq("channel_id", channelId)
    .eq("provider", "drive")
    .maybeSingle();
  if (error) return apiResponse({ accepted: true, deferred: true }, request, 202);
  if (!connection || typeof connection.owner_id !== "string")
    return apiResponse({ accepted: true }, request, 202);
  const operationKey = `drive-webhook:${channelId}:${request.headers.get("x-goog-resource-id") ?? "unknown"}`;
  await inngest.send({
    name: "career/drive.sync.requested.v1",
    id: operationKey,
    data: {
      schemaVersion: 1,
      channelId,
      resourceState: state,
      ownerId: connection.owner_id,
      correlationId: crypto.randomUUID(),
      resourceType: "integration_connection",
      resourceId: connection.id,
      operationKey,
      requestedBy: "provider",
      metadata: { resourceState: state }
    }
  });
  return apiResponse({ accepted: true, event: state }, request, 202);
}
