import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const insight = await client
      .schema("app")
      .from("journal_insights")
      .select("id,journal_entries!inner(owner_id)")
      .eq("id", id)
      .eq("journal_entries.owner_id", ownerId)
      .maybeSingle();
    if (!insight.data) return apiResponse(null, request, 404);
    const status = body.decision === "approved" ? "approved" : "rejected";
    const update = await client
      .schema("app")
      .from("journal_insights")
      .update({
        status,
        decision_note: typeof body.note === "string" ? body.note.slice(0, 1000) : null,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("*")
      .single();
    if (update.error) throw update.error;
    return apiResponse(update.data, request);
  });
}
