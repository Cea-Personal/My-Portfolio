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

function originFromForwardedHeaders(request: Request): string | undefined {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return undefined;
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    new URL(request.url).protocol.replace(":", "");
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return undefined;
  }
}

function localAlias(origin: URL, candidate: URL): boolean {
  if (origin.protocol !== candidate.protocol || origin.port !== candidate.port) return false;
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  return localHosts.has(origin.hostname) && localHosts.has(candidate.hostname);
}

export function isAllowedSameOrigin(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let supplied: URL;
  let expected: URL;
  try {
    supplied = new URL(origin);
    expected = new URL(expectedOrigin);
  } catch {
    return false;
  }
  if (supplied.origin === expected.origin || localAlias(supplied, expected)) return true;

  const forwardedOrigin = originFromForwardedHeaders(request);
  if (forwardedOrigin === supplied.origin) return true;

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredOrigin) {
    try {
      if (new URL(configuredOrigin).origin === supplied.origin) return true;
    } catch {
      // Ignore malformed optional configuration and retain the strict check.
    }
  }
  return false;
}

export function assertSameOrigin(request: Request, expectedOrigin: string): void {
  if (!isAllowedSameOrigin(request, expectedOrigin))
    throw new ProblemError(
      problem(
        "CSRF_ORIGIN_MISMATCH",
        "The request origin is not allowed.",
        403,
        getCorrelationId(request.headers)
      )
    );
}
