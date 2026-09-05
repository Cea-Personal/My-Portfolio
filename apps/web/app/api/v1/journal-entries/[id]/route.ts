import { createHash } from "node:crypto";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { requestCareerBrainRefresh } from "@/inngest/career-brain-events";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const entry = await client
      .schema("app")
      .from("journal_entries")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!entry.data) return apiResponse(null, request, 404);
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 50_000) : "";
    if (!text) return apiResponse({ code: "JOURNAL_TEXT_REQUIRED" }, request, 400);
    const previous = await client
      .schema("app")
      .from("journal_versions")
      .select("version")
      .eq("entry_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previous.error) throw previous.error;
    const next = typeof previous.data?.version === "number" ? previous.data.version + 1 : 1;
    const contentHash = createHash("sha256").update(text).digest("hex");
    const version = await client
      .schema("app")
      .from("journal_versions")
      .insert({
        entry_id: id,
        version: next,
        text,
        content_hash: contentHash
      })
      .select("*")
      .single();
    if (version.error) throw version.error;
    const update = await client
      .schema("app")
      .from("journal_entries")
      .update({
        title: typeof body.title === "string" ? body.title.trim().slice(0, 240) : undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (update.error) throw update.error;
    await requestCareerBrainRefresh(ownerId, "journal", `${id}:${contentHash}`).catch(
      () => undefined
    );
    return apiResponse({ version: version.data }, request);
  });
}
