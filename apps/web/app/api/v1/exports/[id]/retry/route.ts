import { inngest } from "@/inngest/client";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const existing = await client
      .schema("app")
      .from("export_requests")
      .select("id,status,format")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return apiResponse(null, request, 404);
    if (existing.data.status === "completed")
      return apiResponse(
        { code: "EXPORT_ALREADY_COMPLETED", detail: "This export is already ready to download." },
        request,
        409
      );

    const updated = await client
      .schema("app")
      .from("export_requests")
      .update({
        status: "queued",
        object_key: null,
        manifest_hash: null,
        expires_at: null,
        completed_at: null
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("id,status,format")
      .single();
    if (updated.error) throw updated.error;

    try {
      await inngest.send({
        name: "career/export.requested.v1",
        id: `export-retry:${id}:${crypto.randomUUID()}`,
        data: {
          schemaVersion: 1,
          ownerId,
          correlationId: crypto.randomUUID(),
          resourceType: "export_request",
          resourceId: id,
          operationKey: `export:${id}`,
          requestedBy: "owner",
          metadata: { retry: true }
        }
      });
    } catch {
      // The scheduled outbox drain remains the fallback.
    }
    return apiResponse({ export: updated.data, status: "queued" }, request, 202);
  });
}
