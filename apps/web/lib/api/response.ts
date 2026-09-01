import { NextResponse } from "next/server";
import { getCorrelationId } from "@career-os/observability";
import { ProblemError, problem } from "@career-os/contracts";

function isPublicApiPath(request: Request): boolean {
  return new URL(request.url).pathname.startsWith("/api/v1/public/");
}

function hasAuthenticationSignal(request: Request): boolean {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) return true;
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").some((value) => {
    const name = value.trim().split("=", 1)[0] ?? "";
    return name.startsWith("sb-") && name.includes("-auth-token");
  });
}

function privateBoundaryProblem(request: Request) {
  const correlationId = getCorrelationId(request.headers);
  const path = new URL(request.url).pathname;
  const providerCallback =
    path.includes("/integrations/drive/callback") || path.includes("/integrations/drive/webhook");
  if (
    !isPublicApiPath(request) &&
    !providerCallback &&
    path.startsWith("/api/v1") &&
    !hasAuthenticationSignal(request)
  ) {
    return problem("UNAUTHORIZED", "Authentication required.", 401, correlationId);
  }
  if (
    !isPublicApiPath(request) &&
    !providerCallback &&
    path.startsWith("/api/v1") &&
    request.method !== "GET"
  ) {
    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(request.url).origin;
    if (origin && origin !== expectedOrigin)
      return problem(
        "CSRF_ORIGIN_MISMATCH",
        "The request origin is not allowed.",
        403,
        correlationId
      );
    if (
      !path.includes("/callback") &&
      !path.includes("/webhook") &&
      !request.headers.get("idempotency-key")
    )
      return problem(
        "IDEMPOTENCY_REQUIRED",
        "Idempotency-Key is required for this write.",
        400,
        correlationId
      );
  }
  return null;
}

function response<T>(data: T, request: Request, status = 200, cacheControl = "private, no-store") {
  const correlationId = getCorrelationId(request.headers);
  const response = NextResponse.json({ data, correlationId }, { status });
  response.headers.set("cache-control", cacheControl);
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export function apiResponse<T>(data: T, request: Request, status = 200) {
  const boundary = privateBoundaryProblem(request);
  return boundary ? response(boundary, request, boundary.status) : response(data, request, status);
}

export function publicApiResponse<T>(data: T, request: Request, status = 200) {
  return response(data, request, status, "public, max-age=30, stale-while-revalidate=120");
}

export function apiProblem(error: unknown, request: Request) {
  const correlationId = getCorrelationId(request.headers);
  const value =
    error instanceof ProblemError
      ? error.problem
      : problem("REQUEST_FAILED", "The request could not be completed.", 500, correlationId);
  return response(value, request, value.status);
}
