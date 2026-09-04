import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const owned = await client
      .schema("app")
      .from("applications")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!owned.data) return apiResponse([], request, 404);
    const { data, error } = await client
      .schema("app")
      .from("application_required_materials")
      .select("*")
      .eq("application_id", id)
      .order("created_at");
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const owned = await client
      .schema("app")
      .from("applications")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!owned.data) return apiResponse(null, request, 404);
    const body = await request.json().catch(() => ({}));
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 200) : "";
    if (!label) return apiResponse({ code: "MATERIAL_LABEL_REQUIRED" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("application_required_materials")
      .insert({
        application_id: id,
        material_type:
          typeof body.materialType === "string" ? body.materialType.slice(0, 80) : "other",
        label,
        required: body.required !== false,
        notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("MATERIAL_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
