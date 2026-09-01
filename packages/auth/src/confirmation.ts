import { createHash, randomUUID } from "node:crypto";

export interface ConfirmationToken {
  token: string;
  action: string;
  resourceId: string;
  ownerId: string;
  expiresAt: number;
}

const tokens = new Map<string, ConfirmationToken>();

export function issueConfirmationToken(
  ownerId: string,
  action: string,
  resourceId: string,
  ttlMs = 5 * 60_000
): string {
  const raw = randomUUID();
  const token = createHash("sha256").update(raw).digest("base64url");
  tokens.set(token, { token, action, resourceId, ownerId, expiresAt: Date.now() + ttlMs });
  return `${token}.${raw}`;
}

export function consumeConfirmationToken(
  value: string,
  ownerId: string,
  action: string,
  resourceId: string
): boolean {
  const [token] = value.split(".");
  if (!token) return false;
  const entry = tokens.get(token);
  tokens.delete(token);
  return Boolean(
    entry &&
      entry.ownerId === ownerId &&
      entry.action === action &&
      entry.resourceId === resourceId &&
      entry.expiresAt > Date.now()
  );
}
