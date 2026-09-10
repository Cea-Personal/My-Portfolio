import { createHash } from "node:crypto";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function validProjectKey(value: string) {
  return value.length > 0 && value.length <= 160 && !/[\r\n]/.test(value);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectKey: string }> }
) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { projectKey } = await params;
    if (!validProjectKey(projectKey)) return apiResponse({ code: "INVALID_PROJECT_KEY" }, request, 400);
    const result = await client
      .schema("app")
      .from("portfolio_project_media")
      .select(
        "id,project_key,media_type,source_type,status,public_url,alt_text,prompt,provider,model,model_version,created_at,approved_at"
      )
      .eq("owner_id", ownerId)
      .eq("project_key", projectKey)
      .order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return apiResponse({ media: result.data ?? [] }, request);
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectKey: string }> }
) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { projectKey } = await params;
    if (!validProjectKey(projectKey)) return apiResponse({ code: "INVALID_PROJECT_KEY" }, request, 400);
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || !IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES)
      return apiResponse(
        {
          code: "INVALID_PROJECT_IMAGE",
          detail: "Upload a JPEG, PNG, or WebP image no larger than 10 MB."
        },
        request,
        422
      );
    const fileHash = createHash("sha256").update(new Uint8Array(await file.arrayBuffer())).digest("hex");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
    const storagePath = `${ownerId}/portfolio-projects/${createHash("sha256").update(`${projectKey}:${fileHash}:${crypto.randomUUID()}`).digest("hex")}.${extension}`;
    const upload = await client.storage.from("public-media").upload(storagePath, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false
    });
    if (upload.error) throw upload.error;
    const publicUrl = client.storage.from("public-media").getPublicUrl(storagePath).data.publicUrl;
    const altValue = form?.get("altText");
    const altText = typeof altValue === "string" ? altValue.slice(0, 240) : "";
    const inserted = await client
      .schema("app")
      .from("portfolio_project_media")
      .insert({
        owner_id: ownerId,
        project_key: projectKey,
        source_type: "uploaded",
        status: "draft",
        storage_path: storagePath,
        public_url: publicUrl,
        alt_text: altText || "Project cover image"
      })
      .select("id,project_key,media_type,source_type,status,public_url,alt_text,created_at,approved_at")
      .single();
    if (inserted.error || !inserted.data) throw inserted.error ?? new Error("PROJECT_MEDIA_CREATE_FAILED");
    return apiResponse({ media: inserted.data }, request, 201);
  });
}
