import { withPrivateApi } from "@/lib/api/private";
import { apiResponse } from "@/lib/api/response";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("profiles")
      .select("id, display_name, headline, bio, location, timezone, locale, revision")
      .eq("id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}

export async function PATCH(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const expectedRevision = Number(request.headers.get("if-match") ?? body.revision);
    if (!Number.isInteger(expectedRevision))
      return apiResponse({ code: "REVISION_REQUIRED" }, request, 428);
    const { data, error } = await client
      .schema("app")
      .from("profiles")
      .update({
        display_name:
          typeof body.displayName === "string" ? body.displayName.slice(0, 120) : undefined,
        headline: typeof body.headline === "string" ? body.headline.slice(0, 240) : undefined,
        bio: typeof body.bio === "string" ? body.bio.slice(0, 10000) : undefined,
        location: typeof body.location === "string" ? body.location.slice(0, 240) : undefined
      })
      .eq("id", ownerId)
      .eq("revision", expectedRevision)
      .select("id, display_name, headline, bio, location, timezone, locale, revision")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 409);
  });
}
