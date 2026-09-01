import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ProblemError, problem } from "@career-os/contracts";
import { parsePublicEnv } from "@career-os/config";
import { createServerSupabaseClient } from "@career-os/database";
import { assertSameOrigin, requireIdempotencyKey, requireJson } from "./guard";
import { apiProblem } from "./response";
import { getOwnerSession, type OwnerSession } from "@career-os/auth";
import { getCorrelationId } from "@career-os/observability";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PrivateApiContext {
  client: SupabaseClient;
  session: OwnerSession;
  ownerId: string;
  correlationId: string;
}

interface IdempotencyRow {
  request_hash: string;
  status: "in_progress" | "completed" | "failed";
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  expires_at: string;
}

function unauthorized(request: Request): ProblemError {
  return new ProblemError(
    problem("UNAUTHORIZED", "Authentication required.", 401, getCorrelationId(request.headers))
  );
}

export async function requirePrivateApiContext(request: Request): Promise<PrivateApiContext> {
  let env: ReturnType<typeof parsePublicEnv>;
  try {
    env = parsePublicEnv();
  } catch {
    throw unauthorized(request);
  }
  const cookieStore = await cookies();
  const client = createServerSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieStore
  );
  const session = await getOwnerSession(client);
  if (!session) throw unauthorized(request);
  return {
    client,
    session,
    ownerId: session.ownerId,
    correlationId: getCorrelationId(request.headers)
  };
}

export async function withPrivateApi(
  request: Request,
  handler: (context: PrivateApiContext) => Promise<Response> | Response
): Promise<Response> {
  let idempotencyContext:
    | {
        client: SupabaseClient;
        ownerId: string;
        key: string;
        requestHash: string;
      }
    | undefined;
  try {
    let idempotencyKey: string | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (request.method !== "DELETE") requireJson(request);
      assertSameOrigin(request, new URL(request.url).origin);
      idempotencyKey = requireIdempotencyKey(request);
      if (
        (request.method === "PATCH" || request.method === "PUT") &&
        !request.headers.get("if-match")
      ) {
        throw new ProblemError(
          problem(
            "REVISION_REQUIRED",
            "If-Match is required for this mutation.",
            428,
            getCorrelationId(request.headers)
          )
        );
      }
    }
    const context = await requirePrivateApiContext(request);
    if (idempotencyKey) {
      const requestHash = createHash("sha256")
        .update(new Uint8Array(await request.clone().arrayBuffer()))
        .digest("hex");
      idempotencyContext = {
        client: context.client,
        ownerId: context.ownerId,
        key: idempotencyKey,
        requestHash
      };
      const idempotency = context.client.schema("app").from("idempotency_keys");
      const { data: rawExisting, error: lookupError } = await idempotency
        .select("request_hash,status,response_status,response_body,expires_at")
        .eq("owner_id", context.ownerId)
        .eq("key", idempotencyKey)
        .maybeSingle();
      const existing = rawExisting as unknown as IdempotencyRow | null;
      if (lookupError) {
        throw new ProblemError(
          problem(
            "IDEMPOTENCY_UNAVAILABLE",
            "Request replay protection is unavailable.",
            503,
            getCorrelationId(request.headers)
          )
        );
      }
      if (existing && existing.request_hash !== requestHash) {
        throw new ProblemError(
          problem(
            "IDEMPOTENCY_CONFLICT",
            "The idempotency key was used for another request.",
            409,
            getCorrelationId(request.headers)
          )
        );
      }
      if (
        existing &&
        existing.status === "completed" &&
        new Date(existing.expires_at).getTime() > Date.now() &&
        existing.response_body
      ) {
        const replay = NextResponse.json(existing.response_body, {
          status: existing.response_status ?? 200
        });
        replay.headers.set("cache-control", "private, no-store");
        replay.headers.set("x-correlation-id", context.correlationId);
        return replay;
      }
      if (existing?.status === "in_progress") {
        throw new ProblemError(
          problem(
            "IDEMPOTENCY_IN_PROGRESS",
            "An equivalent request is already running.",
            409,
            getCorrelationId(request.headers)
          )
        );
      }
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: writeError } = existing
        ? await idempotency
            .update({
              status: "in_progress",
              response_status: null,
              response_body: null,
              expires_at: expiresAt
            })
            .eq("owner_id", context.ownerId)
            .eq("key", idempotencyKey)
        : await idempotency.insert({
            owner_id: context.ownerId,
            key: idempotencyKey,
            request_hash: requestHash,
            status: "in_progress",
            expires_at: expiresAt
          });
      if (writeError) {
        throw new ProblemError(
          problem(
            "IDEMPOTENCY_UNAVAILABLE",
            "Request replay protection is unavailable.",
            503,
            getCorrelationId(request.headers)
          )
        );
      }
    }
    const response = await handler(context);
    if (request.method !== "GET" && request.method !== "HEAD") {
      const { error: auditError } = await context.client
        .schema("app")
        .from("audit_events")
        .insert({
          owner_id: context.ownerId,
          actor_type: "owner",
          actor_id: context.ownerId,
          action: `${request.method} ${new URL(request.url).pathname}`.slice(0, 120),
          target_type: "http_request",
          correlation_id: context.correlationId,
          after_metadata: { status: response.status }
        });
      if (auditError) throw auditError;
    }
    if (idempotencyContext) {
      const responseBody: unknown = await response
        .clone()
        .json()
        .then((value) => value as unknown)
        .catch(() => ({ data: null, correlationId: context.correlationId }));
      await idempotencyContext.client
        .schema("app")
        .from("idempotency_keys")
        .update({
          status: "completed",
          response_status: response.status,
          response_body: responseBody
        })
        .eq("owner_id", idempotencyContext.ownerId)
        .eq("key", idempotencyContext.key);
    }
    return response;
  } catch (error) {
    const response = apiProblem(error, request);
    if (idempotencyContext) {
      const responseBody: unknown = await response
        .clone()
        .json()
        .then((value) => value as unknown)
        .catch(() => ({ data: null, correlationId: getCorrelationId(request.headers) }));
      await idempotencyContext.client
        .schema("app")
        .from("idempotency_keys")
        .update({
          status: "failed",
          response_status: response.status,
          response_body: responseBody
        })
        .eq("owner_id", idempotencyContext.ownerId)
        .eq("key", idempotencyContext.key);
    }
    return response;
  }
}
