import { createPublicEvent } from "@career-os/analytics";
import { apiResponse } from "@/lib/api/response";
import { createClient } from "@supabase/supabase-js";
import { parsePublicEnv } from "@career-os/config";
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    const event = createPublicEvent(body.name, body.properties);
    const pseudonym = typeof body.pseudonym === "string" ? body.pseudonym : "";
    const consent = body.consent === "granted" ? "granted" : "denied";
    const env = parsePublicEnv();
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
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
