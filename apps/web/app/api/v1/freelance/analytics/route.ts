import { calculateFreelanceFunnel } from "@career-os/analytics";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const result = await client.schema("app").from("freelance_proposals").select("crm_status,approval_state").eq("owner_id", ownerId);
    if (result.error) throw result.error;
    const proposals = result.data ?? [];
    return apiResponse({ analytics: calculateFreelanceFunnel(proposals.map((row) => ({ crmStatus: row.crm_status, approvalState: row.approval_state }))) }, request);
  });
}
