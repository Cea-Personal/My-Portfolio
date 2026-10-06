import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { getFreelanceOpportunity } from "@/lib/server/freelance-opportunities";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const opportunity = await getFreelanceOpportunity(client, ownerId, id);
    return apiResponse(opportunity ? { opportunity } : null, request, opportunity ? 200 : 404);
  });
}
