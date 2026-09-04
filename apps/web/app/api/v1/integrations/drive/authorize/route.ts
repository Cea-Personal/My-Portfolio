import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async () => {
    return apiResponse(
      {
        code: "DRIVE_USER_OAUTH_DISABLED",
        detail:
          "Broad user-Drive OAuth is disabled. Configure the shared-folder service account instead."
      },
      request,
      410
    );
  });
}
