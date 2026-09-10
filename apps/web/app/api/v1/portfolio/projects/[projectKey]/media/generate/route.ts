import { createHash } from "node:crypto";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  generateImageWithFallback,
  resolveImageGenerationProviders,
  type ReferenceImage
} from "@/lib/server/image-generation-provider";

const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REFERENCE_TOTAL_BYTES = 20 * 1024 * 1024;
const REFERENCE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function projectRecord(content: unknown, projectKey: string): Record<string, unknown> | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const projects = (content as Record<string, unknown>).projects;
  if (!Array.isArray(projects)) return null;
  const project = projects.find(
    (candidate) =>
      candidate && typeof candidate === "object" && !Array.isArray(candidate) &&
      (candidate as Record<string, unknown>).id === projectKey
  );
  return project && typeof project === "object" && !Array.isArray(project)
    ? (project as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 1_200) : fallback;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectKey: string }> }
) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { projectKey } = await params;
    if (!projectKey || projectKey.length > 160 || /[\r\n]/.test(projectKey))
      return apiResponse({ code: "INVALID_PROJECT_KEY" }, request, 400);
    const snapshot = await client
      .schema("app")
      .from("career_brain_snapshots")
      .select("content")
      .eq("owner_id", ownerId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapshot.error) throw snapshot.error;
    const project = projectRecord(snapshot.data?.content, projectKey);
    if (!project) return apiResponse({ code: "PROJECT_NOT_FOUND" }, request, 404);
    const references: ReferenceImage[] = [];
    let referenceBytes = 0;
    let customDirection = "";
    if (request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
      const form = await request.formData().catch(() => null);
      customDirection = text(form?.get("direction"));
      for (const candidate of form?.getAll("referenceImages") ?? []) {
        if (!(candidate instanceof File)) continue;
        if (!REFERENCE_IMAGE_TYPES.has(candidate.type) || candidate.size <= 0 || candidate.size > MAX_REFERENCE_IMAGE_BYTES) {
          return apiResponse(
            { code: "INVALID_REFERENCE_IMAGE", detail: "Reference images must be JPEG, PNG, or WebP files no larger than 10 MB each." },
            request,
            422
          );
        }
        if (references.length >= MAX_REFERENCE_IMAGES) {
          return apiResponse(
            { code: "TOO_MANY_REFERENCE_IMAGES", detail: `You can add up to ${MAX_REFERENCE_IMAGES} reference images.` },
            request,
            422
          );
        }
        if (referenceBytes + candidate.size > MAX_REFERENCE_TOTAL_BYTES) {
          return apiResponse(
            { code: "REFERENCE_IMAGES_TOO_LARGE", detail: "Reference images must be 20 MB or less in total." },
            request,
            422
          );
        }
        referenceBytes += candidate.size;
        references.push({
          bytes: new Uint8Array(await candidate.arrayBuffer()),
          mediaType: candidate.type as ReferenceImage["mediaType"],
          filename: candidate.name
        });
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      customDirection = text(body.direction);
    }
    const title = text(project.title, "Personal project");
    const summary = text(project.summary, "A software, data, or AI engineering project.");
    const technologies = Array.isArray(project.technologies)
      ? project.technologies.filter((item): item is string => typeof item === "string").slice(0, 12)
      : [];
    const prompt = [
      "Create a refined editorial portfolio cover image for a senior data and AI engineer.",
      "Show an abstract, technically credible visual metaphor for the system without screenshots, readable words, logos, faces, or brand marks.",
      "Use a calm dark graphite, ivory, and muted teal palette with layered depth, generous negative space, and a sophisticated magazine-art direction.",
      `Project title: ${title}`,
      `Project summary: ${summary}`,
      technologies.length ? `Technologies: ${technologies.join(", ")}` : "",
      customDirection ? `Additional art direction: ${customDirection}` : "",
      references.length
        ? `Use the ${references.length} uploaded reference image${references.length === 1 ? "" : "s"} for visual cues while creating an original cover. Do not copy logos, text, or identifiable people from them.`
        : ""
    ]
      .filter(Boolean)
      .join("\n");
    const providers = await resolveImageGenerationProviders(client, ownerId);
    const generated = await generateImageWithFallback(providers, prompt, references);
    const extension = generated.image.mediaType === "image/jpeg" ? "jpg" : generated.image.mediaType === "image/webp" ? "webp" : "png";
    const storagePath = `${ownerId}/portfolio-projects/${createHash("sha256").update(`${projectKey}:${crypto.randomUUID()}`).digest("hex")}.${extension}`;
    const upload = await client.storage.from("public-media").upload(storagePath, generated.image.bytes, {
      contentType: generated.image.mediaType,
      cacheControl: "31536000",
      upsert: false
    });
    if (upload.error) throw upload.error;
    const publicUrl = client.storage.from("public-media").getPublicUrl(storagePath).data.publicUrl;
    const inserted = await client
      .schema("app")
      .from("portfolio_project_media")
      .insert({
        owner_id: ownerId,
        project_key: projectKey,
        source_type: "ai_generated",
        status: "draft",
        storage_path: storagePath,
        public_url: publicUrl,
        alt_text: `${title} project cover`,
        prompt,
        provider_config_id: generated.provider.id,
        provider: generated.provider.provider,
        model: generated.provider.model,
        model_version: generated.provider.model_version
      })
      .select(
        "id,project_key,media_type,source_type,status,public_url,alt_text,prompt,provider,model,model_version,created_at,approved_at"
      )
      .single();
    if (inserted.error || !inserted.data) throw inserted.error ?? new Error("PROJECT_MEDIA_CREATE_FAILED");
    return apiResponse({ media: inserted.data }, request, 201);
  });
}
