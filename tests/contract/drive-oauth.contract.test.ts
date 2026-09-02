import { describe, expect, it } from "vitest";
import {
  createDriveAuthorizationUrl,
  createPkcePair,
  decryptSecret,
  encryptSecret
} from "../../apps/web/lib/drive-oauth";

const config = {
  clientId: "client-id",
  clientSecret: "server-only-secret",
  encryptionKey: Buffer.alloc(32, 7),
  appUrl: "https://portfolio.example"
};

describe("Drive OAuth boundary", () => {
  it("uses PKCE and never puts the client secret in the authorization URL", () => {
    const { challenge } = createPkcePair();
    const url = createDriveAuthorizationUrl(config, "state-value", challenge);
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("state=state-value");
    expect(url).not.toContain(config.clientSecret);
  });

  it("round-trips encrypted credential material with the server key", () => {
    const encrypted = encryptSecret('{"refresh_token":"secret"}', config.encryptionKey);
    expect(encrypted).not.toContain("refresh_token");
    expect(decryptSecret(encrypted, config.encryptionKey)).toBe('{"refresh_token":"secret"}');
  });
});
