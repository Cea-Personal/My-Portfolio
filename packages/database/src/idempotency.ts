export interface IdempotencyRecord<T = unknown> {
  key: string;
  ownerId: string;
  status: "in_progress" | "completed" | "failed";
  response?: T;
  expiresAt: string;
}

export function normalizeIdempotencyKey(value: string): string {
  const key = value.trim();
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(key)) throw new Error("Invalid idempotency key");
  return key;
}

export function isIdempotencyExpired(
  record: Pick<IdempotencyRecord, "expiresAt">,
  now = new Date()
): boolean {
  return new Date(record.expiresAt).getTime() <= now.getTime();
}
