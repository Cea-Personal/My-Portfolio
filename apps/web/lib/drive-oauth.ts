import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
const DRIVE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/drive.readonly"
];

interface DriveOAuthConfig {
  clientId: string;
  clientSecret: string;
  encryptionKey: Buffer;
  appUrl: string;
}

export function getDriveOAuthConfig(): DriveOAuthConfig | null {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const encodedKey = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !clientSecret || !encodedKey || !appUrl) return null;
  const encryptionKey = Buffer.from(encodedKey, "base64");
  if (encryptionKey.length !== 32) return null;
  return { clientId, clientSecret, encryptionKey, appUrl: appUrl.replace(/\/$/, "") };
}

export function driveRedirectUri(config: DriveOAuthConfig): string {
  return `${config.appUrl}/api/v1/integrations/drive/callback`;
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url")
  };
}

export function createDriveAuthorizationUrl(
  config: DriveOAuthConfig,
  state: string,
  challenge: string
): string {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", driveRedirectUri(config));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export function stateHash(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export function encryptSecret(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string, key: Buffer): string {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("INVALID_ENCRYPTED_SECRET");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export async function exchangeDriveAuthorizationCode(
  config: DriveOAuthConfig,
  code: string,
  verifier: string
): Promise<{ externalAccountId: string; scopes: string[]; tokenPayload: string }> {
  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: driveRedirectUri(config),
      grant_type: "authorization_code",
      code_verifier: verifier
    })
  });
  const token = (await tokenResponse.json().catch(() => null)) as Record<string, unknown> | null;
  if (!tokenResponse.ok || !token || typeof token.access_token !== "string") {
    throw new Error("DRIVE_TOKEN_EXCHANGE_FAILED");
  }
  const accountResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${token.access_token}` }
  });
  const account = (await accountResponse.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!accountResponse.ok || !account || typeof account.sub !== "string") {
    throw new Error("DRIVE_ACCOUNT_LOOKUP_FAILED");
  }
  return {
    externalAccountId: account.sub,
    scopes: typeof token.scope === "string" ? token.scope.split(" ").filter(Boolean) : DRIVE_SCOPES,
    tokenPayload: JSON.stringify({
      access_token: token.access_token,
      refresh_token: typeof token.refresh_token === "string" ? token.refresh_token : null,
      expires_in: typeof token.expires_in === "number" ? token.expires_in : null,
      token_type: typeof token.token_type === "string" ? token.token_type : "Bearer",
      obtained_at: new Date().toISOString()
    })
  };
}
