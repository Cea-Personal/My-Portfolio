import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { generateReasoningJson, resolveReasoningProviders } from "@/lib/server/reasoning-provider";

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
    try {
      const providers = await resolveReasoningProviders(client, ownerId, "writing_assistance");
      const generated = await generateReasoningJson(
        providers,
        [
          "You are the Blog writing editor subagent for Basil Ogbonna.",
          "Use only the supplied prompt and explicitly approved evidence.",
          "Do not invent employers, achievements, metrics, technologies, dates, or outcomes.",
          `Produce a ${mode} suggestion. Return JSON only with status, message, content, editedText, and suggestions.`,
          "Put the usable result in content or editedText; use suggestions for titles, tags, or alternatives.",
          "Keep the result practical and ready to copy into the Blog editor."
        ].join(" "),
        { mode, input, approvedEvidence: evidenceStatements },
        { task: "writing_assistance" }
      );
      const output = generated.output;
      const suggestions = Array.isArray(output.suggestions)
        ? output.suggestions.filter((item): item is string => typeof item === "string")
        : [];
      const content = [output.content, output.editedText, output.message]
        .find((value): value is string => typeof value === "string" && value.trim().length > 0)
        ?.trim();
      const rendered = content || suggestions.join("\n");
      if (!rendered) throw new Error("AI_PROVIDER_RESPONSE_INVALID");
      return apiResponse(
        {
          mode,
          output: rendered,
          evidenceIds,
          provider: generated.provider.provider,
          model: generated.provider.model,
          limitations: [
            "This is drafting assistance, not independently verified proof.",
            "Professional claims remain bounded by the selected approved evidence."
          ]
        },
        request
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message.slice(0, 240) : "WRITING_ASSISTANCE_FAILED";
      return apiResponse({ code: detail.split(":")[0], detail }, request, 503);
    }
  });
}
