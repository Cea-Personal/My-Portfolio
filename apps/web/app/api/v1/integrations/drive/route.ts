import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  getDriveServiceAccountAccessToken,
  getDriveServiceAccountConfig,
  getDriveServiceAccountConfigurationStatus
} from "@/lib/drive-service-account";
import { getDriveFolder } from "@/lib/google-drive-client";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const configuration = getDriveServiceAccountConfigurationStatus();
    const serviceAccount = getDriveServiceAccountConfig();
    const { data, error } = await client
      .schema("app")
      .from("integration_connections")
      .select(
        "id,status,scopes,selected_folder_id,selected_folder_name,last_success_at,last_error_code,created_at"
      )
      .eq("owner_id", ownerId)
      .eq("provider", "drive")
      .eq("connection_type", "service_account")
      .neq("status", "revoked")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(
      {
        connection: data ?? null,
        configuration: {
          ...configuration,
          folderName: serviceAccount?.folderName ?? null,
          serviceAccountEmail: serviceAccount?.clientEmail ?? null
        }
      },
      request
    );
  });
}

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const config = getDriveServiceAccountConfig();
    const status = getDriveServiceAccountConfigurationStatus();
    if (!config)
      return apiResponse(
        {
          code: "DRIVE_SERVICE_ACCOUNT_UNCONFIGURED",
          detail: status.invalid
            ? "The Drive service-account JSON or folder ID is invalid."
            : `Missing server variables: ${status.missing.join(", ")}.`
        },
        request,
        503
      );
    let folder;
    try {
      folder = await getDriveFolder(
        await getDriveServiceAccountAccessToken(config),
        config.folderId
      );
    } catch (error) {
      return apiResponse(
        {
          code: error instanceof Error ? error.message : "DRIVE_SHARED_FOLDER_UNAVAILABLE",
          detail: `Share the configured folder with ${config.clientEmail} as Viewer, then try again.`
        },
        request,
        422
      );
    }
    const { data, error } = await client
      .schema("app")
      .from("integration_connections")
      .upsert(
        {
          owner_id: ownerId,
          provider: "drive",
          connection_type: "service_account",
          external_account_id: config.clientEmail,
          status: "active",
          scopes: ["shared_folder_readonly"],
          secret_ref: "secret:/app/drive-service-account",
          selected_folder_id: config.folderId,
          selected_folder_name: folder.name,
          cursor: null,
          cursor_version: "shared-folder-v1",
          last_error_code: null
        },
        { onConflict: "owner_id,provider,external_account_id" }
      )
      .select(
        "id,status,scopes,selected_folder_id,selected_folder_name,last_success_at,last_error_code,created_at"
      )
      .single();
    if (error || !data) throw error ?? new Error("DRIVE_CONNECTION_FAILED");
    const revoked = await client
      .schema("app")
      .from("integration_connections")
      .update({ status: "revoked" })
      .eq("owner_id", ownerId)
      .eq("provider", "drive")
      .neq("id", data.id)
      .neq("status", "revoked");
    if (revoked.error) throw revoked.error;
    return apiResponse({ connection: data }, request, 201);
  });
}

export async function PATCH(request: Request) {
  return withPrivateApi(request, async () => {
    return apiResponse(
      {
        code: "DRIVE_FOLDER_SERVER_CONTROLLED",
        detail:
          "The shared folder is fixed by GOOGLE_DRIVE_FOLDER_ID and cannot be changed in the browser."
      },
      request,
      405
    );
  });
}
