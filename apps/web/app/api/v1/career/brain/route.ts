import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  hasMeaningfulCareerBrainContent,
  normalizeCareerBrainContent,
  synthesizeCareerBrain
} from "@/lib/server/career-brain-synthesis";

// Career Brain invokes a native subagent and reconciles many private sources.
// Retrieval, reranking, native Codex startup, and structured synthesis can all
// take longer than a normal API request. Keep the HTTP budget above the native
// call budget so the route does not terminate first.
export const maxDuration = 300;

async function readLatest(
  client: Parameters<Parameters<typeof withPrivateApi>[1]>[0]["client"],
  ownerId: string
) {
  const [snapshots, selections] = await Promise.all([
    client
      .schema("app")
      .from("career_brain_snapshots")
      .select("*")
      .eq("owner_id", ownerId)
      .order("generated_at", { ascending: false })
      .limit(20),
    client
      .schema("app")
      .from("career_brain_public_selections")
      .select("item_key,item_type,public_eligible")
      .eq("owner_id", ownerId)
  ]);
  if (snapshots.error) throw snapshots.error;
  if (selections.error) throw selections.error;
  const snapshot = (snapshots.data ?? []).find((candidate) =>
    hasMeaningfulCareerBrainContent(normalizeCareerBrainContent(candidate.content))
  );
  const current = snapshot
    ? { ...snapshot, content: normalizeCareerBrainContent(snapshot.content) }
    : null;
  return { snapshot: current, selections: selections.data ?? [] };
}

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) =>
    apiResponse(await readLatest(client, ownerId), request)
  );
}

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, correlationId, ownerId }) => {
    try {
      const body = await request.json().catch(() => ({}));
      const mode =
        body && typeof body === "object" && "mode" in body && body.mode === "refresh"
          ? "refresh"
          : "resynthesize";
      const generated = await synthesizeCareerBrain(client, ownerId, {
        // Manual re-synthesis is explicitly cache-bypassing. The refresh mode
        // is retained for scheduled/background refreshes and can reuse a fresh
        // retrieval cache entry.
        forceFresh: mode === "resynthesize",
        refreshRetrievalCache: mode === "refresh"
      });
      const current = await readLatest(client, ownerId);
      await recordAudit(client, ownerId, correlationId, "career_brain.generated", null, {
        reused: generated.reused,
        mode
      });
      return apiResponse(
        { ...current, reused: generated.reused },
        request,
        generated.reused ? 200 : 201
      );
    } catch (error) {
      const diagnostic =
        error instanceof Error ? error.message.slice(0, 180) : "CAREER_BRAIN_FAILED";
      const code =
        error instanceof Error
          ? (error.message.split(":")[0] ?? "CAREER_BRAIN_FAILED")
          : "CAREER_BRAIN_FAILED";
      await recordAudit(client, ownerId, correlationId, "career_brain.failed", diagnostic, {
        code
      });
      if (/^(EMBEDDING|AI_CAPABILITY|AI_PROVIDER)/.test(code))
        return apiResponse(
          {
            code,
            detail: `${diagnostic}. Configure the matching enabled provider in Settings, verify its server secret is available to the web process, then regenerate Career Brain.`
          },
          request,
          409
        );
      return apiResponse({ code, detail: diagnostic }, request, 503);
    }
  });
}

async function recordAudit(
  client: Parameters<Parameters<typeof withPrivateApi>[1]>[0]["client"],
  ownerId: string,
  correlationId: string,
  action: string,
  reason: string | null,
  metadata: Record<string, unknown>
) {
  try {
    await client.schema("app").from("audit_events").insert({
      owner_id: ownerId,
      actor_type: "owner",
      action,
      target_type: "career_brain",
      correlation_id: correlationId,
      reason,
      after_metadata: metadata
    });
  } catch {
    // Preserve the original Career Brain result if observability is unavailable.
  }
}
