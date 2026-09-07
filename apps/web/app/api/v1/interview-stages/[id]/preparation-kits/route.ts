import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const stage = await client
      .schema("app")
      .from("interview_stages")
      .select("id,interview_processes!inner(owner_id)")
      .eq("id", id)
      .eq("interview_processes.owner_id", ownerId)
      .maybeSingle();
    if (!stage.data) return apiResponse([], request, 404);
    const { data, error } = await client
      .schema("app")
      .from("preparation_kits")
      .select("*")
      .eq("stage_id", id)
      .order("version", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: stageId } = await params;
    const { data: stage } = await client
      .schema("app")
      .from("interview_stages")
      .select("id,process_id,name,stage_type")
      .eq("id", stageId)
      .maybeSingle();
    if (!stage) return apiResponse(null, request, 404);
    const { data: process } = await client
      .schema("app")
      .from("interview_processes")
      .select("id,application_id,applications(job_id,jobs(current_description))")
      .eq("id", stage.process_id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!process) return apiResponse(null, request, 404);
    const body = await request.json().catch(() => ({}));
    const topics = Array.isArray(body.topics)
      ? body.topics
          .filter((value: unknown): value is string => typeof value === "string")
          .map((value: string) => value.trim())
          .filter(Boolean)
          .slice(0, 30)
      : [];
    const evidenceIds = Array.isArray(body.evidenceIds)
      ? body.evidenceIds
          .filter((value: unknown): value is string => typeof value === "string")
          .slice(0, 50)
      : [];
    let evidenceFacts: Array<{ id: string; current_version_id: string | null }> = [];
    if (evidenceIds.length) {
      const evidence = await client
        .schema("app")
        .from("career_facts")
        .select("id,current_version_id")
        .eq("owner_id", ownerId)
        .eq("verified_by_owner", true)
        .in("review_status", ["approved", "edited_approved"])
        .in("id", evidenceIds);
      if (evidence.error) throw evidence.error;
      if ((evidence.data ?? []).length !== evidenceIds.length)
        return apiResponse({ code: "UNVERIFIED_PREPARATION_EVIDENCE" }, request, 409);
      evidenceFacts = evidence.data ?? [];
    }
    const versionIds = evidenceFacts
      .map((fact) => fact.current_version_id)
      .filter((value): value is string => Boolean(value));
    const versions = versionIds.length
      ? await client
          .schema("app")
          .from("career_fact_versions")
          .select("id,statement,structured_value")
          .in("id", versionIds)
      : { data: [], error: null };
    if (versions.error) throw versions.error;
    const versionsById = new Map((versions.data ?? []).map((version) => [version.id, version]));
    const previous = await client
      .schema("app")
      .from("preparation_kits")
      .select("version")
      .eq("stage_id", stageId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previous.error) throw previous.error;
    const version = typeof previous.data?.version === "number" ? previous.data.version + 1 : 1;
    const questions = topics.map((topic: string, index: number) => {
      const fact = evidenceFacts[index % Math.max(evidenceFacts.length, 1)];
      const version = fact?.current_version_id ? versionsById.get(fact.current_version_id) : null;
      return {
        question: `How have you approached ${topic}?`,
        probability: index < 3 ? "high" : index < 7 ? "medium" : "lower_confidence",
        rationale: `Derived from the ${stage.name} stage and owner-selected role context; not guaranteed.`,
        answer: version?.statement
          ? `Use this documented experience as the core of your answer: ${version.statement}`
          : "No grounded answer is available yet. Add relevant CV or Career Brain information before using this response.",
        evidence: fact
          ? {
              factId: fact.id,
              statement: version?.statement ?? "Approved Career Brain evidence",
              context: version?.structured_value ?? {},
              suggestedTalkingPoints: [
                "Describe the problem and operating context.",
                "State your own contribution and the technologies used.",
                "Close with the supported impact; do not add unsupported metrics."
              ]
            }
          : null
      };
    });
    const payload = {
      stagePurpose:
        typeof body.stagePurpose === "string"
          ? body.stagePurpose.slice(0, 3000)
          : `Prepare for ${stage.name}.`,
      roleRequirements: topics,
      likelyTopics: topics,
      questions,
      strongestExperiences: evidenceIds,
      projects: Array.isArray(body.projects) ? body.projects.slice(0, 20) : [],
      achievements: evidenceIds,
      stories: Array.isArray(body.stories) ? body.stories.slice(0, 20) : [],
      weakAreas: Array.isArray(body.weakAreas) ? body.weakAreas.slice(0, 20) : [],
      companyResearch:
        typeof body.companyResearch === "string" ? body.companyResearch.slice(0, 10000) : "",
      revisionTopics: topics,
      behavioralPreparation:
        typeof body.behavioralPreparation === "string"
          ? body.behavioralPreparation.slice(0, 10000)
          : "",
      interviewerQuestions: Array.isArray(body.interviewerQuestions)
        ? body.interviewerQuestions.slice(0, 20)
        : [],
      compensationPreparation:
        typeof body.compensationPreparation === "string"
          ? body.compensationPreparation.slice(0, 5000)
          : "",
      personalNotes: typeof body.notes === "string" ? body.notes.slice(0, 10000) : "",
      limitations: ["Question likelihood is a preparation aid, not a prediction guarantee."]
    };
    const { data, error } = await client
      .schema("app")
      .from("preparation_kits")
      .insert({
        stage_id: stageId,
        schema_version: "preparation-kit.v2",
        version,
        status: "ready",
        evidence_ids: evidenceIds,
        payload
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("PREPARATION_KIT_CREATE_FAILED");
    return apiResponse({ status: "ready", kit: data }, request, 201);
  });
}
