import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: entryId } = await params;
    const { data: entry } = await client
      .schema("app")
      .from("journal_entries")
      .select("id")
      .eq("id", entryId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!entry) return apiResponse(null, request, 404);
    const { data: version } = await client
      .schema("app")
      .from("journal_versions")
      .select("content_hash")
      .eq("entry_id", entryId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!version) return apiResponse({ status: "pending", entryId }, request, 202);
    const { data, error } = await client
      .schema("app")
      .from("journal_insights")
      .insert({
        entry_id: entryId,
        text: "Insights are pending review.",
        source_version_hash: version.content_hash,
        status: "candidate"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("INSIGHT_RUN_FAILED");
    return apiResponse({ status: "pending", insight: data }, request, 202);
  });
}
