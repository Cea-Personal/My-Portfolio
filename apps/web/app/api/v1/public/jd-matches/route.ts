import { hostilePublicInput } from "@career-os/ai";
import { parsePublicEnv } from "@career-os/config";
import { createClient } from "@supabase/supabase-js";
import { captureSanitizedError } from "@career-os/observability";
import { allowPublicAiRequest } from "@/lib/public-ai-rate-limit";
import { loadPublicPortfolio } from "@/lib/api/public-data";
import { publicApiResponse } from "@/lib/api/response";
import { generateReasoningJson, resolveReasoningProviders } from "@/lib/server/reasoning-provider";
import {
  parsePublicRoleFit,
  publicRoleFitFailure,
  publicRoleFitRequest,
  publicRoleFitContext,
  PUBLIC_ROLE_FIT_INSTRUCTION
} from "@/lib/server/public-role-fit";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!allowPublicAiRequest(`jd:${key}`, 20))
    return publicApiResponse(
      { code: "RATE_LIMITED", detail: "Please try again later." },
      request,
      429
    );
  const description = typeof body.description === "string" ? body.description.slice(0, 50_000) : "";
  if (!description.trim() || hostilePublicInput(description))
    return publicApiResponse(
      {
        code: !description.trim() ? "EMPTY_JOB_DESCRIPTION" : "UNSAFE_INSTRUCTION",
        detail: "Provide a job description without instructions directed at the assistant."
      },
      request,
      400
    );
  const snapshot = await loadPublicPortfolio();
  if (snapshot.source !== "live")
    return publicApiResponse(
      {
        summary: "Portfolio information is temporarily unavailable.",
        matches: [],
        abstained: true,
        unavailable: true,
        reason: "PUBLIC_EVIDENCE_UNAVAILABLE"
      },
      request
    );
  const context = publicRoleFitContext(snapshot);
  if (!context.length)
    return publicApiResponse(
      parsePublicRoleFit({ summary: "", matches: [] }, description, context),
      request
    );
  try {
    const ownerId =
      typeof snapshot.publication?.owner_id === "string" ? snapshot.publication.owner_id : "";
    if (!ownerId) throw new Error("ROLE_FIT_OWNER_UNAVAILABLE");
    const env = parsePublicEnv();
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
    const providers = await resolveReasoningProviders(client, ownerId, "role_fit");
    // Reserve time for a configured fallback within this route's deadline.
    const budget = Math.floor(90_000 / Math.max(providers.length, 1));
    const generated = await generateReasoningJson(
      providers.map((provider) => ({
        ...provider,
        timeoutMs: Math.min(provider.timeoutMs, budget),
        retryLimit: 0
      })),
      PUBLIC_ROLE_FIT_INSTRUCTION,
      publicRoleFitRequest(description, context),
      { task: "role_fit" }
    );
    return publicApiResponse(parsePublicRoleFit(generated.output, description, context), request);
  } catch (error) {
    captureSanitizedError(error, { route: "/api/v1/public/jd-matches" });
    return publicApiResponse(
      {
        ...publicRoleFitFailure(error),
        matches: [],
        abstained: true,
        unavailable: true
      },
      request,
      503
    );
  }
}
