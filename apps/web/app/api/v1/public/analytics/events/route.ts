import { createPublicEvent } from "@career-os/analytics";
import { apiResponse } from "@/lib/api/response";
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    return apiResponse(createPublicEvent(body.name, body.properties), request, 202);
  } catch {
    return apiResponse({ code: "EVENT_NOT_ALLOWED" }, request, 400);
  }
}
