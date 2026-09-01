import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data, error } = await client
      .schema("app")
      .from("automation_schedules")
      .update({
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        recurrence: typeof body.recurrence === "string" ? body.recurrence.slice(0, 120) : undefined,
        next_run_at: typeof body.nextRunAt === "string" ? body.nextRunAt : undefined
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
