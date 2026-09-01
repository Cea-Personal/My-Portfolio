export function isRetryable(code: string): boolean {
  return ["TIMEOUT", "PROVIDER_429", "PROVIDER_5XX", "WORKER_LOST", "TEMPORARY_LOCK"].includes(
    code
  );
}
export function isTerminal(status: string): boolean {
  return ["completed", "partial", "failed", "cancelled"].includes(status);
}
