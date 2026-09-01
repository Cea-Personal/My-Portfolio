import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function PATCH(request: Request) {
  return withPrivateApi(request, async () =>
    apiResponse(await request.json().catch(() => ({})), request)
  );
}
