import { loadPublicPortfolio } from "@/lib/api/public-data";
import { publicApiResponse } from "@/lib/api/response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await loadPublicPortfolio();
  const evidence = snapshot.evidence.find((item) => item.public_evidence_id === id);
  if (!evidence) return publicApiResponse(null, request, 404);
  return publicApiResponse(
    {
      publicEvidenceId: evidence.public_evidence_id,
      safeTitle: evidence.safe_title,
      issuer: evidence.issuer,
      occurredOn: evidence.occurred_on,
      sanitizedExcerpt: evidence.sanitized_excerpt,
      sourceLocationLabel: evidence.source_location_label,
      evidenceType: evidence.evidence_type,
      sourceVersionHash: evidence.source_version_hash
    },
    request
  );
}
