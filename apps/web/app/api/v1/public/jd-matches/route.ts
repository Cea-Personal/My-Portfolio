import { extractRequirements, matchRequirements, scoreRequirements } from "@career-os/jobs";
import { allowPublicAiRequest } from "@/lib/public-ai-rate-limit";
import { loadPublicPortfolio } from "@/lib/api/public-data";
import { publicApiResponse } from "@/lib/api/response";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!allowPublicAiRequest(`jd:${key}`, 20))
    return publicApiResponse(
      { code: "RATE_LIMITED", detail: "Please try again later." },
      request,
      429
    );
  const description = typeof body.description === "string" ? body.description.slice(0, 50_000) : "";
  const requirements = extractRequirements(description);
  const snapshot = await loadPublicPortfolio();
  const evidence = snapshot.evidence.flatMap((item) => {
    const content = typeof item.sanitized_excerpt === "string" ? item.sanitized_excerpt : "";
    const id = typeof item.public_evidence_id === "string" ? item.public_evidence_id : "";
    return content && id
      ? [
          {
            id,
            content,
            visibility: "public" as const,
            metadata: { title: typeof item.safe_title === "string" ? item.safe_title : "" }
          }
        ]
      : [];
  });
  const matches = matchRequirements(requirements, evidence);
  return publicApiResponse(
    {
      ...scoreRequirements(matches),
      requirements: matches.map((match) => ({
        ...match,
        evidenceValue: match.evidenceValue ?? match.match
      })),
      abstained: matches.length === 0 || matches.every((match) => match.match === 0)
    },
    request
  );
}
