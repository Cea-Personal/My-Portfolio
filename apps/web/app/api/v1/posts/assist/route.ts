import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

const modes = new Set(["ideas", "outline", "draft", "rewrite", "summary", "titles", "tags", "seo"]);

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const mode = typeof body.mode === "string" ? body.mode : "";
    const input = typeof body.input === "string" ? body.input.trim().slice(0, 30_000) : "";
    if (!modes.has(mode) || !input)
      return apiResponse({ code: "INVALID_WRITING_REQUEST" }, request, 400);
    const evidenceIds = Array.isArray(body.evidenceIds)
      ? body.evidenceIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    let evidenceStatements: string[] = [];
    if (body.includeCareerEvidence === true) {
      if (!evidenceIds.length)
        return apiResponse({ code: "CAREER_CLAIM_EVIDENCE_REQUIRED" }, request, 409);
      const facts = await client
        .schema("app")
        .from("career_facts")
        .select("id,current_version_id")
        .eq("owner_id", ownerId)
        .eq("verified_by_owner", true)
        .in("review_status", ["approved", "edited_approved"])
        .in("id", evidenceIds);
      if (facts.error) throw facts.error;
      if ((facts.data ?? []).length !== evidenceIds.length)
        return apiResponse({ code: "UNVERIFIED_ARTICLE_EVIDENCE" }, request, 409);
      const versionIds = (facts.data ?? [])
        .map((fact) => fact.current_version_id as string | null)
        .filter((id): id is string => Boolean(id));
      const versions = versionIds.length
        ? await client
            .schema("app")
            .from("career_fact_versions")
            .select("statement")
            .in("id", versionIds)
        : { data: [], error: null };
      if (versions.error) throw versions.error;
      evidenceStatements = (versions.data ?? []).map((version) => version.statement as string);
    }
    const evidence = evidenceStatements.length
      ? `\n\nApproved evidence available (do not exceed these claims):\n${evidenceStatements.map((item) => `- ${item}`).join("\n")}`
      : "";
    const outputs: Record<string, string> = {
      ideas: `Explore three angles: the system constraint behind ${input}; the trade-off that mattered; and a practical field guide.`,
      outline: `# Working title\n\n## The problem\n${input}\n\n## Constraints\n\n## Approach\n\n## Trade-offs\n\n## What to test next${evidence}`,
      draft: `# Draft\n\n${input}\n\nExplain the operating context, the decision, the implementation, and the observable result. Separate demonstrated facts from interpretation.${evidence}`,
      rewrite: `${input}\n\nRevision note: tighten the opening, use concrete verbs, state constraints, and qualify every unsupported conclusion.${evidence}`,
      summary: input.length > 320 ? `${input.slice(0, 317)}…` : input,
      titles: `1. Building the reliable version of ${input.slice(0, 100)}\n2. What ${input.slice(0, 100)} taught me\n3. A practical guide to ${input.slice(0, 100)}`,
      tags: input
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((word: string) => word.length > 4)
        .slice(0, 8)
        .join(", "),
      seo: `SEO title: ${input.slice(0, 60)}\nMeta description: A practical engineering note about ${input.slice(0, 130)}.`
    };
    return apiResponse(
      {
        mode,
        output: outputs[mode],
        evidenceIds,
        limitations: [
          "This is drafting assistance, not independently verified proof.",
          "Professional claims remain bounded by the selected approved evidence."
        ]
      },
      request
    );
  });
}
