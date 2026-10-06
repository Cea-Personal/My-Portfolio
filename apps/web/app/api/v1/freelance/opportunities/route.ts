import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { createFreelanceOpportunity, listFreelanceOpportunities } from "@/lib/server/freelance-opportunities";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    return apiResponse({ opportunities: await listFreelanceOpportunities(client, ownerId) }, request);
  });
}

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const parsed = await request.json().catch(() => ({}));
    const body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    if (typeof body.title !== "string" || typeof body.description !== "string")
      return apiResponse({ code: "INVALID_FREELANCE_OPPORTUNITY", detail: "title and description are required" }, request, 400);
    try {
      const opportunity = await createFreelanceOpportunity(client, ownerId, {
        provider: "upwork",
        title: body.title,
        description: body.description,
        ...(typeof body.url === "string" ? { url: body.url } : {}),
        ...(typeof body.clientName === "string" ? { clientName: body.clientName } : {}),
        ...(typeof body.clientUrl === "string" ? { clientUrl: body.clientUrl } : {}),
        ...(typeof body.clientCountry === "string" ? { clientCountry: body.clientCountry } : {}),
        ...(typeof body.clientTimezone === "string" ? { clientTimezone: body.clientTimezone } : {}),
        ...(typeof body.budgetType === "string" ? { budgetType: body.budgetType as "hourly" | "fixed" | "milestone" | "unknown" } : {}),
        ...(typeof body.budgetMin === "number" ? { budgetMin: body.budgetMin } : {}),
        ...(typeof body.budgetMax === "number" ? { budgetMax: body.budgetMax } : {}),
        ...(typeof body.hourlyMin === "number" ? { hourlyMin: body.hourlyMin } : {}),
        ...(typeof body.hourlyMax === "number" ? { hourlyMax: body.hourlyMax } : {}),
        ...(typeof body.currency === "string" ? { currency: body.currency } : {}),
        ...(typeof body.duration === "string" ? { duration: body.duration } : {}),
        ...(typeof body.timezoneRequirements === "string" ? { timezoneRequirements: body.timezoneRequirements } : {}),
        ...(Array.isArray(body.skills) ? { skills: body.skills.filter((value): value is string => typeof value === "string") } : {}),
        ...(Array.isArray(body.serviceTags) ? { serviceTags: body.serviceTags.filter((value): value is string => typeof value === "string") } : {}),
        ...(typeof body.ownerNotes === "string" ? { ownerNotes: body.ownerNotes } : {})
      });
      return apiResponse({ opportunity }, request, 201);
    } catch (error) {
      if (error instanceof Error && error.name === "DUPLICATE_FREELANCE_OPPORTUNITY")
        return apiResponse({ code: error.name, detail: "This opportunity was already imported." }, request, 409);
      if (error instanceof Error && /_(REQUIRED|INVALID|MUST_BE_URL|MUST_USE_HTTPS)$/.test(error.message))
        return apiResponse({ code: error.message, detail: "The imported opportunity is incomplete." }, request, 400);
      throw error;
    }
  });
}
