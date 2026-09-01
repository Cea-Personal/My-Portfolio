import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("skills")
      .select("id, name, description")
      .eq("owner_id", ownerId);
    if (error) throw error;
    return apiResponse(
      {
        gaps: (data ?? [])
          .filter((item) => !item.description)
          .map((item) => ({ skillId: item.id, skill: item.name, type: "no_evidence_documented" }))
      },
      request
    );
  });
}
