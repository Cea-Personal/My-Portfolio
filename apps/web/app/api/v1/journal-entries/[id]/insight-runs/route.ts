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
      .is("deleted_at", null)
      .maybeSingle();
    if (!entry) return apiResponse(null, request, 404);
    const { data: version } = await client
      .schema("app")
      .from("journal_versions")
      .select("content_hash,text")
      .eq("entry_id", entryId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!version) return apiResponse({ status: "pending", entryId }, request, 202);
    const topics = version.text
      .split(/[.!?]/)
      .map((value: string) => value.trim())
      .filter(Boolean)
      .slice(0, 12);
    const rows = topics.map((text: string) => ({
      entry_id: entryId,
      text,
      kind: /strong|well|success/i.test(text)
        ? "strength"
        : /difficult|weak|gap|unclear/i.test(text)
          ? "gap"
          : "theme",
      source_version_hash: version.content_hash,
      status: "candidate"
    }));
    if (!rows.length)
      return apiResponse(
        { code: "NO_DERIVABLE_INSIGHTS", detail: "Add journal text before deriving insights." },
        request,
        422
      );
    const { data, error } = await client
      .schema("app")
      .from("journal_insights")
      .insert(rows)
      .select("*");
    if (error) throw error;
    return apiResponse({ status: "review_required", insights: data ?? [] }, request, 201);
  });
}
