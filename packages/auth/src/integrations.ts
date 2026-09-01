import { assertSecretReference } from "@career-os/config";

export interface IntegrationConnection {
  provider: string;
  externalAccountId: string;
  scopes: readonly string[];
  secretRef: string;
  status: "pending" | "active" | "error" | "revoked";
}

export function createIntegrationConnection(
  input: Omit<IntegrationConnection, "secretRef"> & { secretRef: string }
): IntegrationConnection {
  return {
    ...input,
    secretRef: assertSecretReference(input.secretRef),
    scopes: [...new Set(input.scopes)].sort()
  };
}

export function revokeIntegration(connection: IntegrationConnection): IntegrationConnection {
  return { ...connection, status: "revoked" };
}
