import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { createHash } from "node:crypto";
import { validateLinkedInJobUrl } from "@/lib/job-source-config";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("jobs")
      .select(
        "*, job_descriptions(*, job_requirements(*, job_requirement_matches(*))), job_source_references(*), job_scores(*), job_status_history(*)"
      )
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data ? { job: data } : null, request, data ? 200 : 404);
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const parsedBody = await request.json().catch(() => ({}));
    const body =
      parsedBody && typeof parsedBody === "object"
        ? (parsedBody as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const existing = await client
      .schema("app")
      .from("jobs")
      .select(
        "canonical_company,canonical_title,location,current_description,source_url,source_provider"
      )
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return apiResponse(null, request, 404);
    const company =
      typeof body.company === "string"
        ? body.company.trim().slice(0, 240)
        : existing.data.canonical_company;
    const title =
      typeof body.title === "string"
        ? body.title.trim().slice(0, 240)
        : existing.data.canonical_title;
    const location =
      typeof body.location === "string"
        ? body.location.trim().slice(0, 240)
        : existing.data.location;
    if (!company || !title) return apiResponse({ code: "INVALID_JOB" }, request, 400);
    const sourceUrl =
      body.sourceUrl === undefined
        ? existing.data.source_url
        : typeof body.sourceUrl === "string" && body.sourceUrl.trim()
          ? validateLinkedInJobUrl(body.sourceUrl)
          : null;
    if (body.sourceUrl && !sourceUrl)
      return apiResponse(
        {
          code: "INVALID_SOURCE_URL",
          detail: "Use an HTTPS LinkedIn job URL supplied by the owner."
        },
        request,
        400
      );
    const description =
      typeof body.description === "string" ? body.description.trim().slice(0, 50_000) : undefined;
    const { data, error } = await client
      .schema("app")
      .from("jobs")
      .update({
        canonical_company: company,
        canonical_title: title,
        location,
        current_description: description ?? undefined,
        source_url: sourceUrl,
        source_provider: sourceUrl
          ? "linkedin_manual"
          : (existing.data.source_provider ?? "manual"),
        normalized_fingerprint: createHash("sha256")
          .update(
            `${company.toLowerCase()}|${title.toLowerCase()}|${String(location).toLowerCase()}`
          )
          .digest("hex")
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (data && description && description !== existing.data.current_description) {
      const previous = await client
        .schema("app")
        .from("job_descriptions")
        .select("version")
        .eq("job_id", id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previous.error) throw previous.error;
      const deactivate = await client
        .schema("app")
        .from("job_descriptions")
        .update({ active: false })
        .eq("job_id", id)
        .eq("active", true);
      if (deactivate.error) throw deactivate.error;
      const version = await client
        .schema("app")
        .from("job_descriptions")
        .insert({
          job_id: id,
          version:
            typeof previous.data?.version === "number" && Number.isInteger(previous.data.version)
              ? previous.data.version + 1
              : 1,
          original_text_hash: createHash("sha256").update(description).digest("hex"),
          normalized_text: description,
          source: "owner",
          active: true
        });
      if (version.error) throw version.error;
    }
    return apiResponse(data, request, data ? 200 : 404);
  });
}
