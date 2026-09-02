import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  createDriveAuthorizationUrl,
  createPkcePair,
  encryptSecret,
  getDriveOAuthConfig,
  stateHash
} from "@/lib/drive-oauth";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const config = getDriveOAuthConfig();
    if (!config) {
      return apiResponse(
        {
          code: "DRIVE_OAUTH_UNCONFIGURED",
          detail: "Drive OAuth is not configured for this environment."
        },
        request,
        503
      );
    }
    const state = crypto.randomUUID();
    const { verifier, challenge } = createPkcePair();
    const { error } = await client
      .schema("app")
      .from("drive_oauth_states")
      .insert({
        owner_id: ownerId,
        state_hash: stateHash(state),
        verifier_ciphertext: encryptSecret(verifier, config.encryptionKey),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      });
    if (error) throw error;
    return apiResponse(
      { authorizationUrl: createDriveAuthorizationUrl(config, state, challenge) },
      request
    );
  });
}
