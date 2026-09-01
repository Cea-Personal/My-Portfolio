import { problem, ProblemError } from "@career-os/contracts";
import { getCorrelationId } from "@career-os/observability";

export function requireJson(
  request: Request,
  correlationId = getCorrelationId(request.headers)
): string {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json"))
    throw new ProblemError(
      problem("UNSUPPORTED_MEDIA_TYPE", "JSON is required.", 415, correlationId)
    );
  return correlationId;
}

export function requireIdempotencyKey(request: Request, required = true): string | undefined {
  const key = request.headers.get("idempotency-key")?.trim();
  if (required && !key)
    throw new ProblemError(
      problem(
        "IDEMPOTENCY_REQUIRED",
        "Idempotency-Key is required for this write.",
        400,
        getCorrelationId(request.headers)
      )
    );
  if (key && !/^[A-Za-z0-9._:-]{16,128}$/.test(key))
    throw new ProblemError(
      problem(
        "INVALID_IDEMPOTENCY_KEY",
        "The idempotency key is invalid.",
        400,
        getCorrelationId(request.headers)
      )
    );
  return key;
}

export function assertSameOrigin(request: Request, expectedOrigin: string): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin)
    throw new ProblemError(
      problem(
        "CSRF_ORIGIN_MISMATCH",
        "The request origin is not allowed.",
        403,
        getCorrelationId(request.headers)
      )
    );
}
