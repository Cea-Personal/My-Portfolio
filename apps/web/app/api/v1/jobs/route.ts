import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { validateJobSourceEndpoint, validateLinkedInJobUrl } from "@/lib/job-source-config";
import { createHash } from "node:crypto";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("jobs")
      .select("*, job_scores(*), job_source_references(*)")
      .eq("owner_id", ownerId)
      .order("discovered_at", { ascending: false });
    if (error) throw error;
    return apiResponse({ jobs: data ?? [] }, request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const parsedBody = await request.json().catch(() => ({}));
    const body =
      parsedBody && typeof parsedBody === "object"
        ? (parsedBody as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      typeof body.company !== "string" ||
      !body.company.trim()
    )
      return apiResponse(
        { code: "INVALID_JOB", detail: "company and title are required" },
        request,
        400
      );
    const sourceProvider = body.sourceProvider === "live_web" ? "live_web" : "manual";
    const sourceUrl =
      typeof body.sourceUrl === "string" && body.sourceUrl.trim()
        ? sourceProvider === "live_web"
          ? validateJobSourceEndpoint(body.sourceUrl)
          : validateLinkedInJobUrl(body.sourceUrl)
        : null;
    if (body.sourceUrl && !sourceUrl)
      return apiResponse(
        {
          code: "INVALID_SOURCE_URL",
          detail:
            sourceProvider === "live_web"
              ? "Use an HTTPS public listing URL returned by live discovery."
              : "Use an HTTPS LinkedIn job URL supplied by the owner. The link is stored, not scraped."
        },
        request,
        400
      );
    const persistedSourceProvider =
      sourceProvider === "live_web" ? "live_web" : sourceUrl ? "linkedin_manual" : "manual";
    const { data, error } = await client
      .schema("app")
      .from("jobs")
      .insert({
        owner_id: ownerId,
        canonical_company: body.company.trim().slice(0, 240),
        canonical_title: body.title.trim().slice(0, 240),
        location: typeof body.location === "string" ? body.location.slice(0, 240) : null,
        current_description:
          typeof body.description === "string" ? body.description.slice(0, 50000) : null,
        source_url: sourceUrl,
        source_provider: persistedSourceProvider,
        normalized_fingerprint: createHash("sha256")
          .update(
            `${body.company.trim().toLowerCase()}|${body.title.trim().toLowerCase()}|${typeof body.location === "string" ? body.location.trim().toLowerCase() : ""}`
          )
          .digest("hex"),
        status: "discovered"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("JOB_CREATE_FAILED");
    const history = await client.schema("app").from("job_status_history").insert({
      job_id: data.id,
      from_status: null,
      to_status: "discovered",
      actor_id: ownerId,
      reason: "manual_creation"
    });
    if (history.error) throw history.error;
    if (typeof body.description === "string" && body.description.trim()) {
      const description = body.description.trim().slice(0, 50_000);
      const version = await client
        .schema("app")
        .from("job_descriptions")
        .insert({
          job_id: data.id,
          version: 1,
          original_text_hash: createHash("sha256").update(description).digest("hex"),
          normalized_text: description,
          source: "owner"
        });
      if (version.error) throw version.error;
    }
    return apiResponse({ job: data }, request, 201);
  });
}
