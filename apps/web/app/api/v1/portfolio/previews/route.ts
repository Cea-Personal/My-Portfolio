import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const rules = await client
      .schema("app")
      .from("portfolio_projection_rules")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("public_eligible", true)
      .order("display_order");
    const items = (rules.data ?? []).map((rule) => ({
      public_id: `${rule.source_entity_type}:${rule.source_entity_id}`,
      source_entity_type: rule.source_entity_type,
      source_entity_id: rule.source_entity_id,
      section: rule.section ?? rule.source_entity_type,
      career_stage: rule.career_stage,
      display_order: rule.display_order,
      title: rule.source_entity_type,
      public_summary: rule.public_summary_override ?? "Approved public evidence",
      display_technologies: rule.selected_technologies ?? [],
      sanitized_media: rule.selected_media ?? [],
      public_citations: []
    }));
    const contentHash = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(JSON.stringify(items)))
      .then((bytes) =>
        Array.from(new Uint8Array(bytes))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("")
      );
    const { data: latest } = await client
      .schema("published")
      .from("portfolio_publications")
      .select("version")
      .eq("owner_id", ownerId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: publication, error } = await client
      .schema("published")
      .from("portfolio_publications")
      .insert({
        owner_id: ownerId,
        version: Number(latest?.version ?? 0) + 1,
        status: "staged",
        content_hash: contentHash,
        schema_version: "portfolio.v1"
      })
      .select("*")
      .single();
    if (error || !publication) throw error ?? new Error("PORTFOLIO_PREVIEW_FAILED");
    if (items.length) {
      const { error: itemError } = await client
        .schema("published")
        .from("portfolio_items")
        .insert(items.map((item) => ({ ...item, publication_id: publication.id })));
      if (itemError) throw itemError;
    }
    return apiResponse({ ...publication, items }, request, 202);
  });
}
