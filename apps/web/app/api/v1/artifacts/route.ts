import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const type = new URL(request.url).searchParams.get("type");
    let query = client
      .schema("app")
      .from("generated_artifacts")
      .select("*,artifact_versions(*)")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (type) query = query.eq("artifact_type", type);
    const { data, error } = await query;
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
