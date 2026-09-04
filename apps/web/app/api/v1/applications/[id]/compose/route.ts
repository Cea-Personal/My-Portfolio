import { createHash } from "node:crypto";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { renderPdf } from "@career-os/applications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: applicationId } = await params;
    const body = await request.json().catch(() => ({}));
    const artifactType =
      body.artifactType === "cover_letter"
        ? "cover_letter"
        : body.artifactType === "resume"
          ? "resume"
          : null;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 40_000) : "";
    const evidenceIds = Array.isArray(body.evidenceIds)
      ? [
          ...new Set(
            body.evidenceIds.filter((value: unknown): value is string => typeof value === "string")
          )
        ].slice(0, 100)
      : [];
    const requiredEvidence =
      artifactType === "cover_letter"
        ? evidenceIds.length >= 2 && evidenceIds.length <= 4
        : evidenceIds.length >= 1;
    if (!artifactType || !title || !content || !requiredEvidence)
      return apiResponse({ code: "EVIDENCE_BACKED_CONTENT_REQUIRED" }, request, 400);
    const application = await client
      .schema("app")
      .from("applications")
      .select("id,job_id,jobs(current_description)")
      .eq("id", applicationId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (application.error) throw application.error;
    if (!application.data) return apiResponse(null, request, 404);
    const facts = await client
      .schema("app")
      .from("career_facts")
      .select("id,current_version_id,review_status,verified_by_owner")
      .eq("owner_id", ownerId)
      .in("id", evidenceIds)
      .in("review_status", ["approved", "edited_approved"])
      .eq("verified_by_owner", true);
    if (facts.error) throw facts.error;
    if ((facts.data ?? []).length !== evidenceIds.length)
      return apiResponse({ code: "UNVERIFIED_ARTIFACT_EVIDENCE" }, request, 409);
    const template = typeof body.template === "string" ? body.template.slice(0, 40) : "technical";
    const rendered = renderPdf(content, template);
    const artifact = await client
      .schema("app")
      .from("generated_artifacts")
      .insert({
        owner_id: ownerId,
        application_id: applicationId,
        artifact_type: artifactType,
        title
      })
      .select("*")
      .single();
    if (artifact.error || !artifact.data)
      throw artifact.error ?? new Error("ARTIFACT_CREATE_FAILED");
    const objectKey = `${ownerId}/${artifact.data.id}/1.pdf`;
    const upload = await client.storage
      .from("private-artifact")
      .upload(objectKey, rendered.bytes, { contentType: "application/pdf", upsert: false });
    if (upload.error) throw upload.error;
    const manifest = {
      artifactType,
      title,
      content,
      template,
      tone: typeof body.tone === "string" ? body.tone.slice(0, 40) : "professional"
    };
    const version = await client
      .schema("app")
      .from("artifact_versions")
      .insert({
        artifact_id: artifact.data.id,
        version: 1,
        status: "draft",
        storage_key: objectKey,
        media_type: "application/pdf",
        binary_hash: rendered.hash,
        content_manifest_hash: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
        renderer_version: rendered.rendererVersion,
        evidence_ids: evidenceIds,
        structured_content: manifest,
        provenance: {
          applicationId,
          jobId: application.data.job_id,
          careerFactVersionIds: (facts.data ?? []).map((fact) => fact.current_version_id),
          generatedAt: new Date().toISOString()
        }
      })
      .select("*")
      .single();
    if (version.error || !version.data)
      throw version.error ?? new Error("ARTIFACT_VERSION_CREATE_FAILED");
    const current = await client
      .schema("app")
      .from("generated_artifacts")
      .update({ current_version_id: version.data.id })
      .eq("id", artifact.data.id)
      .eq("owner_id", ownerId);
    if (current.error) throw current.error;
    return apiResponse({ artifact: artifact.data, version: version.data }, request, 201);
  });
}
