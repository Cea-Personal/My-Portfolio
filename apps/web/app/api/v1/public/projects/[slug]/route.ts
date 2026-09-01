import { loadPublicPortfolio } from "@/lib/api/public-data";
import { publicApiResponse } from "@/lib/api/response";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await loadPublicPortfolio();
  const item = snapshot.items.find(
    (candidate) => candidate.source_entity_type === "project" && candidate.detail_slug === slug
  );
  if (!item) return publicApiResponse(null, request, 404);
  return publicApiResponse(
    {
      publicId: item.public_id,
      title: item.title,
      subtitle: item.subtitle,
      publicSummary: item.public_summary,
      displayMetric: item.display_metric,
      displayTechnologies: item.display_technologies,
      sanitizedMedia: item.sanitized_media,
      publicCitations: item.public_citations
    },
    request
  );
}
