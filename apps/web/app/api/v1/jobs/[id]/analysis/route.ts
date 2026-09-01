import { createHash } from "node:crypto";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data: ownedJob, error: jobError } = await client
      .schema("app")
      .from("jobs")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!ownedJob) return apiResponse({ analysis: null }, request, 404);
    const { data, error } = await client
      .schema("app")
      .from("job_descriptions")
      .select("*")
      .eq("job_id", id)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiResponse({ analysis: null }, request, 404);
    return apiResponse({ analysis: data }, request, 200);
  });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const text = typeof body.description === "string" ? body.description.slice(0, 50_000) : "";
    if (!text.trim()) return apiResponse({ code: "DESCRIPTION_REQUIRED" }, request, 400);
    const { data: job } = await client
      .schema("app")
      .from("jobs")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!job) return apiResponse(null, request, 404);
    const { data: previous } = await client
      .schema("app")
      .from("job_descriptions")
      .select("version")
      .eq("job_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const previousVersion = (previous as { version?: unknown } | null)?.version;
    const nextVersion =
      typeof previousVersion === "number" && Number.isInteger(previousVersion)
        ? previousVersion + 1
        : 1;
    const { data, error } = await client
      .schema("app")
      .from("job_descriptions")
      .insert({
        job_id: id,
        version: nextVersion,
        original_text_hash: createHash("sha256").update(text).digest("hex"),
        normalized_text: text,
        source: "owner"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("JOB_ANALYSIS_FAILED");
    return apiResponse({ analysis: data }, request, 202);
  });
}
