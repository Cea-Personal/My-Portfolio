import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { createHash } from "node:crypto";
import { requestCareerBrainRefresh } from "@/inngest/career-brain-events";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("journal_entries")
      .select("*, journal_versions(*), journal_insights(*)")
      .eq("owner_id", ownerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const entries = (data ?? []).map((entry) => ({
      ...entry,
      // Older rows and relationship failures can surface nullable child
      // collections. Keep the client contract array-shaped.
      journal_versions: Array.isArray(entry.journal_versions) ? entry.journal_versions : [],
      journal_insights: Array.isArray(entry.journal_insights) ? entry.journal_insights : []
    }));
    return apiResponse({ entries }, request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.text !== "string" || !body.text.trim())
      return apiResponse({ code: "INVALID_JOURNAL_ENTRY" }, request, 400);
    const { data: entry, error } = await client
      .schema("app")
      .from("journal_entries")
      .insert({
        owner_id: ownerId,
        title: typeof body.title === "string" ? body.title.trim().slice(0, 240) : "Journal entry",
        entry_date:
          typeof body.entryDate === "string"
            ? body.entryDate
            : new Date().toISOString().slice(0, 10),
        related_type:
          typeof body.relatedType === "string" ? body.relatedType.slice(0, 80) : "general",
        related_id: typeof body.relatedId === "string" && body.relatedId ? body.relatedId : null,
        attachment_keys: Array.isArray(body.attachmentKeys) ? body.attachmentKeys.slice(0, 20) : []
      })
      .select("*")
      .single();
    if (error || !entry) throw error ?? new Error("JOURNAL_CREATE_FAILED");
    const contentHash = createHash("sha256").update(body.text).digest("hex");
    const { data: version, error: versionError } = await client
      .schema("app")
      .from("journal_versions")
      .insert({
        entry_id: entry.id,
        version: 1,
        text: body.text.slice(0, 50000),
        content_hash: contentHash
      })
      .select("*")
      .single();
    if (versionError || !version) throw versionError ?? new Error("JOURNAL_VERSION_CREATE_FAILED");
    const tags = Array.isArray(body.tags)
      ? body.tags
          .filter((tag: unknown): tag is string => typeof tag === "string")
          .map((tag: string) => tag.trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 30)
      : [];
    if (tags.length) {
      const insertedTags = await client
        .schema("app")
        .from("journal_tags")
        .insert(tags.map((tag: string) => ({ entry_id: entry.id, tag })));
      if (insertedTags.error) throw insertedTags.error;
    }
    await requestCareerBrainRefresh(ownerId, "journal", `${entry.id}:${contentHash}`).catch(
      () => undefined
    );
    return apiResponse({ ...entry, currentVersion: version }, request, 201);
  });
}
