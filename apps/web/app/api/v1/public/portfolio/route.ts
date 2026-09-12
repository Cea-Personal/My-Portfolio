import { loadPublicPortfolio } from "@/lib/api/public-data";
import { publicApiResponse } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const sectionTitles: Record<string, string> = {
  hero: "Hero",
  about: "About",
  career: "Experience",
  projects: "Projects",
  blog: "Blog",
  contact: "Contact"
};

export async function GET(request: Request) {
  const snapshot = await loadPublicPortfolio();
  const groups = new Map<string, { id: string; title: string; items: unknown[] }>();
  for (const item of snapshot.items) {
    const sourceType = typeof item.source_entity_type === "string" ? item.source_entity_type : "";
    const section =
      sourceType === "post"
        ? "blog"
        : sourceType === "project"
          ? "projects"
          : ["experience", "project", "achievement", "skill"].includes(sourceType)
            ? "career"
            : sourceType;
    if (!section) continue;
    const current = groups.get(section) ?? {
      id: section,
      title: sectionTitles[section] ?? section,
      items: []
    };
    current.items.push({
      publicId: item.public_id,
      sourceEntityType: sourceType,
      sourceEntityId: item.source_entity_id,
      section,
      careerStage: item.career_stage,
      title: item.title,
      subtitle: item.subtitle,
      publicSummary: item.public_summary,
      displayMetric: item.display_metric,
      displayTechnologies: item.display_technologies,
      sanitizedMedia: item.sanitized_media,
      publicCitations: item.public_citations,
      detailSlug: item.detail_slug
    });
    groups.set(section, current);
  }
  const sections = [...groups.values()].map((group) => ({
    ...group,
    items: group.items
  }));
  return publicApiResponse(
    {
      version: snapshot.publication ? Number(snapshot.publication.version ?? 0) : 0,
      contentHash: snapshot.publication?.content_hash ?? null,
      schemaVersion: snapshot.publication?.schema_version ?? "portfolio.v1",
      source: snapshot.source,
      stale: snapshot.stale,
      sections,
      evidence: snapshot.evidence.map((item) => ({
        publicEvidenceId: item.public_evidence_id,
        safeTitle: item.safe_title,
        issuer: item.issuer,
        occurredOn: item.occurred_on,
        sanitizedExcerpt: item.sanitized_excerpt,
        sourceLocationLabel: item.source_location_label,
        evidenceType: item.evidence_type,
        sourceVersionHash: item.source_version_hash
      }))
    },
    request
  );
}
