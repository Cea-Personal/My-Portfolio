import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  getDriveServiceAccountAccessToken,
  getDriveServiceAccountConfig
} from "@/lib/drive-service-account";
import { getDriveFolder } from "@/lib/google-drive-client";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const connectionId = new URL(request.url).searchParams.get("connectionId");
    if (!connectionId) return apiResponse({ code: "CONNECTION_REQUIRED" }, request, 400);
    const { data: connection, error } = await client
      .schema("app")
      .from("integration_connections")
      .select("id,status")
      .eq("id", connectionId)
      .eq("owner_id", ownerId)
      .eq("provider", "drive")
      .maybeSingle();
    if (error) throw error;
    if (!connection || connection.status !== "active")
      return apiResponse({ code: "DRIVE_CONNECTION_NOT_FOUND" }, request, 404);
    const config = getDriveServiceAccountConfig();
    if (!config) return apiResponse({ code: "DRIVE_SERVICE_ACCOUNT_UNCONFIGURED" }, request, 503);
    const folder = await getDriveFolder(
      await getDriveServiceAccountAccessToken(config),
      config.folderId
    );
    return apiResponse({ folders: [folder] }, request);
  });
}
