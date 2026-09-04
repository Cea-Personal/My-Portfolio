import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDriveServiceAccountAccessToken,
  getDriveServiceAccountConfig,
  resetDriveServiceAccountTokenForTests
} from "./drive-service-account";

const priorJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64;
const priorFolder = process.env.GOOGLE_DRIVE_FOLDER_ID;

afterEach(() => {
  if (priorJson === undefined) delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64;
  else process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 = priorJson;
  if (priorFolder === undefined) delete process.env.GOOGLE_DRIVE_FOLDER_ID;
  else process.env.GOOGLE_DRIVE_FOLDER_ID = priorFolder;
  resetDriveServiceAccountTokenForTests();
  vi.unstubAllGlobals();
});

describe("Drive shared-folder service account", () => {
  it("rejects incomplete or malformed configuration", () => {
    delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64;
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    expect(getDriveServiceAccountConfig()).toBeNull();
  });

  it("exchanges a signed assertion without exposing the private key", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from(
      JSON.stringify({
        type: "service_account",
        client_email: "portfolio-reader@example.iam.gserviceaccount.com",
        private_key: pem,
        token_uri: "https://oauth2.googleapis.com/token"
      })
    ).toString("base64");
    process.env.GOOGLE_DRIVE_FOLDER_ID = "folder_123456789";
    let sentBody = "";
    const fetchMock = vi
      .fn()
      .mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
        sentBody =
          init?.body instanceof URLSearchParams
            ? init.body.toString()
            : typeof init?.body === "string"
              ? init.body
              : "";
        return Promise.resolve(
          new Response(JSON.stringify({ access_token: "folder-token", expires_in: 3600 }), {
            status: 200
          })
        );
      });
    vi.stubGlobal("fetch", fetchMock);
    const config = getDriveServiceAccountConfig();
    expect(config).toMatchObject({ folderId: "folder_123456789" });
    if (!config) throw new Error("fixture configuration was rejected");
    await expect(getDriveServiceAccountAccessToken(config)).resolves.toBe("folder-token");
    expect(sentBody).toContain("jwt-bearer");
    expect(sentBody).not.toContain("BEGIN+PRIVATE+KEY");
  });
});
