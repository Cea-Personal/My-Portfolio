import { ProblemError, problem } from "@career-os/contracts";

const SECRET_REF = /^secret:\/[a-z0-9][a-z0-9._/-]{2,255}$/;

export function assertSecretReference(value: string, correlationId = "local-validation"): string {
  if (!SECRET_REF.test(value)) {
    throw new ProblemError(
      problem(
        "INVALID_SECRET_REFERENCE",
        "A secret manager reference is required.",
        400,
        correlationId
      )
    );
  }
  return value;
}

export function redactSecretReference(value: string): string {
  return value.replace(/[^/]+$/, "[redacted]");
}

export function assertNoPlaintextSecret(
  value: unknown,
  keys = ["secret", "token", "password", "client_secret"]
): void {
  if (!value || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  for (const key of Object.keys(object)) {
    if (keys.includes(key.toLowerCase()) && typeof object[key] === "string" && object[key]) {
      throw new Error(`Plaintext secret field is not allowed: ${key}`);
    }
  }
}
