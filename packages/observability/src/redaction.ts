const SENSITIVE_KEYS =
  /prompt|answer|cv|resume|job.?description|journal|secret|token|signed.?url|credential|content/i;

export function redactTelemetry(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactTelemetry);
  if (typeof value === "string") return /canary|secret/i.test(value) ? "[REDACTED]" : value;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.test(key) ? "[REDACTED]" : redactTelemetry(item)
    ])
  );
}
