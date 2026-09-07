import { createPublicEvent } from "@career-os/analytics";
import { apiResponse } from "@/lib/api/response";
import { createServiceSupabaseClient } from "@career-os/database/service";
import { parsePublicEnv } from "@career-os/config";
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    const event = createPublicEvent(body.name, body.properties);
    const pseudonym = typeof body.pseudonym === "string" ? body.pseudonym : "";
    const consent = body.consent === "granted" ? "granted" : "denied";
    const env = parsePublicEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) throw new Error("ANALYTICS_SERVICE_UNAVAILABLE");
    const client = createServiceSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey);
    const { data, error } = await client.schema("app").rpc("record_public_analytics_event", {
      requested_name: event.name,
      requested_properties: event.properties,
      requested_pseudonym: pseudonym,
      requested_consent: consent
    });
    if (error) throw error;
    return apiResponse(
      { accepted: true, eventId: data, schemaVersion: event.schemaVersion },
      request,
      202
    );
  } catch {
    return apiResponse({ code: "EVENT_NOT_ALLOWED" }, request, 400);
  }
}
