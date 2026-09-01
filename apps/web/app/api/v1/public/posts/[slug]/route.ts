import { loadPublicPortfolio } from "@/lib/api/public-data";
import { publicApiResponse } from "@/lib/api/response";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await loadPublicPortfolio();
  const item = snapshot.items.find(
    (candidate) => candidate.source_entity_type === "post" && candidate.detail_slug === slug
  );
  if (!item) return publicApiResponse(null, request, 404);
  return publicApiResponse(
    {
      publicId: item.public_id,
      title: item.title,
      publicSummary: item.public_summary,
      publicCitations: item.public_citations
    },
    request
  );
}
