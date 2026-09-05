import { type InterviewEvidence, type InterviewStory } from "@career-os/interviews";
import { createServiceSupabaseClient } from "@career-os/database/service";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { generateInterviewKitWithLlm } from "@/lib/server/interview-kit-llm";

type ProcessApplication = {
  job_id?: string | null;
  jobs?: {
    canonical_title?: string | null;
    canonical_company?: string | null;
    current_description?: string | null;
    job_descriptions?: Array<{
      normalized_text?: string | null;
      active?: boolean | null;
      version?: number | null;
    }>;
  } | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function inferredStages(description: string): Array<{ name: string; stageType: string }> {
  const signals: Array<{ pattern: RegExp; name: string; stageType: string }> = [
    {
      pattern: /recruiter|talent acquisition|phone screen/i,
      name: "Recruiter screen",
      stageType: "recruiter"
    },
    {
      pattern: /take[- ]?home|coding challenge|technical assessment/i,
      name: "Technical assessment",
      stageType: "technical"
    },
    {
      pattern: /system design|architecture interview/i,
      name: "System design",
      stageType: "system_design"
    },
    {
      pattern: /technical interview|coding interview|live coding/i,
      name: "Technical interview",
      stageType: "technical"
    },
    {
      pattern: /behavioral interview|values interview/i,
      name: "Behavioral interview",
      stageType: "behavioral"
    },
    { pattern: /hiring manager/i, name: "Hiring manager", stageType: "hiring_manager" },
    { pattern: /panel|onsite|loop/i, name: "Panel interview", stageType: "leadership" }
  ];
  const found = signals
    .map((signal) => ({ ...signal, position: description.search(signal.pattern) }))
    .filter((signal) => signal.position >= 0)
    .sort((left, right) => left.position - right.position);
  return found.length
    ? found.map(({ name, stageType }) => ({ name, stageType }))
    : [{ name: "Interview process unknown", stageType: "unknown" }];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: processId } = await params;
    const supabaseUrl =
      globalThis.process.env.NEXT_PUBLIC_SUPABASE_URL ?? globalThis.process.env.SUPABASE_URL;
    const serviceRoleKey = globalThis.process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey)
      return apiResponse({ code: "AI_SERVICE_UNAVAILABLE" }, request, 503);
    const serviceClient = createServiceSupabaseClient(supabaseUrl, serviceRoleKey);
    const { data: process, error: processError } = await client
      .schema("app")
      .from("interview_processes")
      .select(
        "id,application_id,confidence,applications(job_id,jobs(canonical_title,canonical_company,current_description,job_descriptions(normalized_text,active)))"
      )
      .eq("id", processId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (processError) throw processError;
    if (!process) return apiResponse(null, request, 404);

    const application = one(
      process.applications as ProcessApplication | ProcessApplication[] | null
    );
    const job = one(
      application?.jobs as ProcessApplication["jobs"] | ProcessApplication["jobs"][] | null
    );
    const activeDescription = job?.job_descriptions
      ?.filter((version) => version.active !== false && typeof version.normalized_text === "string")
      .sort((left, right) => (right.version ?? 0) - (left.version ?? 0))
      .at(0)?.normalized_text;
    const description =
      typeof job?.current_description === "string" && job.current_description.trim()
        ? job.current_description
        : (activeDescription ?? "");
    const title = job?.canonical_title || "the selected role";
    const company = job?.canonical_company || "the employer";

    const { data: initialStages, error: stagesError } = await client
      .schema("app")
      .from("interview_stages")
      .select("id,name,stage_type,status,display_order,scheduled_at,notes,confidence,source")
      .eq("process_id", processId)
      .order("display_order", { ascending: true });
    if (stagesError) throw stagesError;
    let stages = initialStages;
    if (!stages?.length) {
      const inferred = inferredStages(description);
      const inserted = await client
        .schema("app")
        .from("interview_stages")
        .insert(
          inferred.map((stage, displayOrder) => ({
            process_id: processId,
            name: stage.name,
            stage_type: stage.stageType,
            display_order: displayOrder,
            status: "proposed",
            source: stage.stageType === "unknown" ? "unknown" : "jd",
            confidence: stage.stageType === "unknown" ? "low" : "medium",
            preparation_state: "not_started"
          }))
        )
        .select("id,name,stage_type,status,display_order,scheduled_at,notes,confidence,source");
      if (inserted.error) throw inserted.error;
      stages = inserted.data ?? [];
      await client
        .schema("app")
        .from("interview_processes")
        .update({ confidence: description.trim() ? "medium" : "low" })
        .eq("id", processId)
        .eq("owner_id", ownerId);
    }

    const { data: facts, error: factsError } = await client
      .schema("app")
      .from("career_facts")
      .select("id,fact_type,current_version_id")
      .eq("owner_id", ownerId)
      .eq("verified_by_owner", true)
      .in("review_status", ["approved", "edited_approved"]);
    if (factsError) throw factsError;
    const versionIds = (facts ?? [])
      .map((fact) => fact.current_version_id as string | null)
      .filter((value): value is string => Boolean(value));
    const { data: versions, error: versionsError } = versionIds.length
      ? await client
          .schema("app")
          .from("career_fact_versions")
          .select("id,statement,structured_value")
          .in("id", versionIds)
      : { data: [], error: null };
    if (versionsError) throw versionsError;
    const versionById = new Map((versions ?? []).map((version) => [version.id, version]));
    const evidence: InterviewEvidence[] = (facts ?? []).flatMap((fact) => {
      const version = fact.current_version_id ? versionById.get(fact.current_version_id) : null;
      return version?.statement
        ? [
            {
              id: fact.id,
              factType: fact.fact_type,
              statement: version.statement,
              structuredValue: (version.structured_value ?? {}) as Record<string, unknown>
            }
          ]
        : [];
    });
    const { data: stories, error: storiesError } = await client
      .schema("app")
      .from("star_stories")
      .select("id,title,situation,task,action,result,skills,technologies,evidence_ids")
      .eq("owner_id", ownerId);
    if (storiesError) throw storiesError;
    const { data: documents, error: documentsError } = await client
      .schema("app")
      .from("documents")
      .select(
        "id,name,evidence_sources(evidence_versions(evidence_chunks(id,content,visibility,deleted_at)))"
      )
      .eq("owner_id", ownerId)
      .is("removed_at", null);
    if (documentsError) throw documentsError;
    const documentContext = (documents ?? []).flatMap((document) => {
      const name = typeof document.name === "string" ? document.name : "Private document";
      if (!/cv|resume|curriculum vitae/i.test(name)) return [];
      const source = one(
        document.evidence_sources as Record<string, unknown> | Record<string, unknown>[] | null
      );
      const versions = Array.isArray(source?.evidence_versions)
        ? source.evidence_versions
        : source?.evidence_versions
          ? [source.evidence_versions]
          : [];
      const chunks = versions.flatMap((version) => {
        const record = version as Record<string, unknown>;
        return Array.isArray(record.evidence_chunks) ? record.evidence_chunks : [];
      });
      return chunks
        .filter((chunk): chunk is Record<string, unknown> => {
          const record = chunk as Record<string, unknown>;
          return (
            typeof record.content === "string" &&
            record.deleted_at == null &&
            (record.visibility === "private" || record.visibility == null)
          );
        })
        .slice(0, 24)
        .map((chunk) => ({
          id: String(chunk.id ?? document.id),
          name,
          content: String(chunk.content).slice(0, 4000)
        }));
    });
    const generated: Array<{ stageId: string; kit: unknown; limitations: string[] }> = [];
    for (const stage of stages ?? []) {
      const generation = await generateInterviewKitWithLlm(serviceClient, ownerId, {
        jobTitle: title,
        company,
        description,
        stage: { id: stage.id, name: stage.name, stageType: stage.stage_type ?? "unknown" },
        evidence,
        stories: (stories ?? []) as InterviewStory[],
        documentContext
      });
      const kit = generation.kit;
      const previous = await client
        .schema("app")
        .from("preparation_kits")
        .select("version")
        .eq("stage_id", stage.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previous.error) throw previous.error;
      const version = typeof previous.data?.version === "number" ? previous.data.version + 1 : 1;
      const inserted = await client
        .schema("app")
        .from("preparation_kits")
        .insert({
          stage_id: stage.id,
          schema_version: "preparation-kit.v2",
          version,
          status: "ready",
          evidence_ids: kit.strongestExperiences,
          payload: kit
        })
        .select("*")
        .single();
      if (inserted.error || !inserted.data)
        throw inserted.error ?? new Error("INTERVIEW_KIT_CREATE_FAILED");
      const stageUpdate = await client
        .schema("app")
        .from("interview_stages")
        .update({ preparation_state: "ready" })
        .eq("id", stage.id);
      if (stageUpdate.error) throw stageUpdate.error;
      const aiRun = await serviceClient.schema("app").from("ai_runs").insert({
        owner_id: ownerId,
        task: "interview_preparation",
        provider_config_id: generation.run.providerConfigId,
        status: "completed",
        input_hash: generation.run.inputHash,
        output_hash: generation.run.outputHash,
        instruction_version: "interview-preparation.v1",
        elapsed_ms: generation.run.elapsedMs,
        related_type: "interview_stage",
        related_id: stage.id,
        finished_at: new Date().toISOString()
      });
      if (aiRun.error) throw aiRun.error;
      generated.push({ stageId: stage.id, kit: inserted.data, limitations: kit.limitations });
    }
    return apiResponse(
      {
        processId,
        status: "ready",
        stages: stages ?? [],
        kitsGenerated: generated.length,
        kits: generated,
        limitations: [
          "Interview question probabilities are preparation signals, not guarantees.",
          "Approved Career Brain facts and private indexed CV excerpts ground the package; missing details are surfaced for verification."
        ]
      },
      request,
      201
    );
  });
}
