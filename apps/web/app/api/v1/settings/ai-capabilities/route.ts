import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client }) => {
    const [capabilities, providers] = await Promise.all([
      client.schema("app").rpc("list_ai_capabilities"),
      client.schema("app").rpc("list_available_ai_providers")
    ]);
    if (capabilities.error) throw capabilities.error;
    if (providers.error) throw providers.error;
    return apiResponse(
      { capabilities: capabilities.data ?? [], providers: providers.data ?? [] },
      request
    );
  });
}
