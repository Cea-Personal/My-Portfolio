import { sign } from "node:crypto";

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface DriveServiceAccountConfig {
  clientEmail: string;
  privateKey: string;
  folderId: string;
  folderName: string;
}

interface ServiceAccountJson {
  type?: unknown;
  client_email?: unknown;
  private_key?: unknown;
  token_uri?: unknown;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export function getDriveServiceAccountConfig(): DriveServiceAccountConfig | null {
  const encoded = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!encoded || !folderId || !/^[A-Za-z0-9_-]{10,200}$/.test(folderId)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8")
    ) as ServiceAccountJson;
    if (
      parsed.type !== "service_account" ||
      typeof parsed.client_email !== "string" ||
      !parsed.client_email.endsWith(".gserviceaccount.com") ||
      typeof parsed.private_key !== "string" ||
      !parsed.private_key.includes("BEGIN PRIVATE KEY") ||
      (parsed.token_uri !== undefined && parsed.token_uri !== GOOGLE_TOKEN_ENDPOINT)
    )
      return null;
    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
      folderId,
      folderName: process.env.GOOGLE_DRIVE_FOLDER_NAME?.trim().slice(0, 255) || "Resumes"
    };
  } catch {
    return null;
  }
}

export function getDriveServiceAccountConfigurationStatus(): {
  configured: boolean;
  missing: string[];
  invalid: boolean;
} {
  const required = ["GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64", "GOOGLE_DRIVE_FOLDER_ID"] as const;
  const missing = required.filter((name) => !process.env[name]);
  return {
    configured: Boolean(getDriveServiceAccountConfig()),
    missing,
    invalid: missing.length === 0 && !getDriveServiceAccountConfig()
  };
}

function encodedJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export async function getDriveServiceAccountAccessToken(
  config: DriveServiceAccountConfig,
  now = Date.now()
): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.accessToken;
  const issuedAt = Math.floor(now / 1000);
  const header = encodedJson({ alg: "RS256", typ: "JWT" });
  const claims = encodedJson({
    iss: config.clientEmail,
    scope: DRIVE_READONLY_SCOPE,
    aud: GOOGLE_TOKEN_ENDPOINT,
    iat: issuedAt,
    exp: issuedAt + 3600
  });
  const unsigned = `${header}.${claims}`;
  const assertion = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), config.privateKey).toString("base64url")}`;
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }),
    signal: AbortSignal.timeout(20_000)
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload || typeof payload.access_token !== "string")
    throw new Error("DRIVE_SERVICE_ACCOUNT_AUTH_FAILED");
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  cachedToken = { accessToken: payload.access_token, expiresAt: now + expiresIn * 1000 };
  return payload.access_token;
}

export function resetDriveServiceAccountTokenForTests(): void {
  cachedToken = null;
}
