import { randomUUID } from "node:crypto";

const CORRELATION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function newCorrelationId(): string {
  return randomUUID();
}

export function getCorrelationId(headers: Headers): string {
  const supplied = headers.get("x-correlation-id") ?? headers.get("traceparent");
  return supplied && CORRELATION_PATTERN.test(supplied) ? supplied : newCorrelationId();
}

export function withCorrelation<T extends Record<string, unknown>>(
  value: T,
  correlationId: string
): T & { correlationId: string } {
  return { ...value, correlationId };
}
