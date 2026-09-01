import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request) {
  return withPrivateApi(request, async () =>
    apiResponse({ uploadId: crypto.randomUUID(), status: "created" }, request, 202)
  );
}
