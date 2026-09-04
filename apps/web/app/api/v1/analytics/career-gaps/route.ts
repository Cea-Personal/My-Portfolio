import { countBy, parseAnalyticsFilters } from "@/lib/analytics-filters";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
interface Skill {
  id: string;
  name: string;
  self_assessment: "possessed" | "learning" | "not_possessed";
}
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    let filters;
    try {
      filters = parseAnalyticsFilters(request, ["role", "country", "from", "to"]);
    } catch (error) {
      return apiResponse(
        { code: error instanceof Error ? error.message : "INVALID_FILTER" },
        request,
        400
      );
    }
    let requirementQuery = client
      .schema("app")
      .from("job_requirements")
      .select(
        "skills,confidence,job_descriptions!inner(fetched_at,jobs!inner(owner_id,canonical_title,country))"
      )
      .eq("job_descriptions.jobs.owner_id", ownerId)
      .limit(5000);
    if (filters.role)
      requirementQuery = requirementQuery.ilike(
        "job_descriptions.jobs.canonical_title",
        `%${filters.role}%`
      );
    if (filters.country)
      requirementQuery = requirementQuery.eq("job_descriptions.jobs.country", filters.country);
    if (filters.from)
      requirementQuery = requirementQuery.gte("job_descriptions.fetched_at", filters.from);
    if (filters.to)
      requirementQuery = requirementQuery.lte("job_descriptions.fetched_at", filters.to);
    const [requirementResult, skillResult, factResult] = await Promise.all([
      requirementQuery,
      client.schema("app").from("skills").select("id,name,self_assessment").eq("owner_id", ownerId),
      client
        .schema("app")
        .from("career_facts")
        .select("id,current_version_id")
        .eq("owner_id", ownerId)
        .eq("verified_by_owner", true)
        .in("review_status", ["approved", "edited_approved"])
    ]);
    if (requirementResult.error) throw requirementResult.error;
    if (skillResult.error) throw skillResult.error;
    if (factResult.error) throw factResult.error;
    const versionIds = (factResult.data ?? [])
      .map((fact) => fact.current_version_id as string | null)
      .filter((id): id is string => Boolean(id));
    const versionResult = versionIds.length
      ? await client
          .schema("app")
          .from("career_fact_versions")
          .select("statement,structured_value")
          .in("id", versionIds)
      : { data: [], error: null };
    if (versionResult.error) throw versionResult.error;
    const documentedText = (versionResult.data ?? [])
      .map((version) => `${String(version.statement)} ${JSON.stringify(version.structured_value)}`)
      .join(" ")
      .toLowerCase();
    const demand = countBy(
      (requirementResult.data ?? [])
        .flatMap((row) => (row.skills ?? []) as string[])
        .map((skill) => skill.trim())
        .filter(Boolean)
    );
    const inventory = new Map(
      ((skillResult.data ?? []) as Skill[]).map((skill) => [skill.name.toLowerCase(), skill])
    );
    const gaps = Object.entries(demand)
      .sort((a, b) => b[1] - a[1])
      .map(([skill, demandCount]) => {
        const self = inventory.get(skill.toLowerCase());
        const documented = documentedText.includes(skill.toLowerCase());
        const status = documented
          ? "documented"
          : self?.self_assessment === "not_possessed"
            ? "not_possessed"
            : self?.self_assessment === "possessed"
              ? "no_evidence_documented"
              : self?.self_assessment === "learning"
                ? "learning"
                : "assessment_required";
        const actions =
          status === "documented"
            ? []
            : status === "no_evidence_documented"
              ? ["Document an existing example in Career Brain."]
              : status === "not_possessed"
                ? ["Learn or practise the skill.", "Build a demonstrative project after learning."]
                : status === "learning"
                  ? [
                      "Build a demonstrative project.",
                      "Publish a technical article about the learning."
                    ]
                  : [
                      "Record whether this skill is possessed, learning, or not possessed; absence of evidence is not evidence of absence."
                    ];
        return { skill, demandCount, status, actions };
      });
    return apiResponse(
      {
        gaps,
        marketDemand: demand,
        sampledRequirements: requirementResult.data?.length ?? 0,
        filters,
        calculationVersion: "analytics.v2"
      },
      request
    );
  });
}
