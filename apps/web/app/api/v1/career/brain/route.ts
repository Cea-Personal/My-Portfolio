import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  normalizeCareerBrainContent,
  synthesizeCareerBrain
} from "@/lib/server/career-brain-synthesis";

async function readLatest(
  client: Parameters<Parameters<typeof withPrivateApi>[1]>[0]["client"],
  ownerId: string
) {
  const [snapshot, selections] = await Promise.all([
    client
      .schema("app")
      .from("career_brain_snapshots")
      .select("*")
      .eq("owner_id", ownerId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .schema("app")
      .from("career_brain_public_selections")
      .select("item_key,item_type,public_eligible")
      .eq("owner_id", ownerId)
  ]);
  if (snapshot.error) throw snapshot.error;
  if (selections.error) throw selections.error;
  const current = snapshot.data
    ? { ...snapshot.data, content: normalizeCareerBrainContent(snapshot.data.content) }
    : null;
  return { snapshot: current, selections: selections.data ?? [] };
}

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) =>
    apiResponse(await readLatest(client, ownerId), request)
  );
}

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    try {
      const generated = await synthesizeCareerBrain(client, ownerId);
      const current = await readLatest(client, ownerId);
      await recordAudit(client, ownerId, "career_brain.generated", null, {
        reused: generated.reused
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
      await recordAudit(client, ownerId, "career_brain.failed", diagnostic, { code });
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
      reason,
      after_metadata: metadata
    });
  } catch {
    // Preserve the original Career Brain result if observability is unavailable.
  }
}
