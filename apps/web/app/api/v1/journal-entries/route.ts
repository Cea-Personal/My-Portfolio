import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("journal_entries")
      .select("*, journal_versions(*), journal_insights(*)")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
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
      .insert({ owner_id: ownerId })
      .select("*")
      .single();
    if (error || !entry) throw error ?? new Error("JOURNAL_CREATE_FAILED");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.text));
    const contentHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
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
    return apiResponse({ ...entry, currentVersion: version }, request, 201);
  });
}
