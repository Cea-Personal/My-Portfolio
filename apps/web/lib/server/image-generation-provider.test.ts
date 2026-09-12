import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateImageWithProvider,
  type ResolvedImageProvider
} from "./image-generation-provider";

const provider: ResolvedImageProvider = {
  id: "provider-1",
  provider: "openai",
  model: "gpt-image-1",
  model_version: "",
  capabilities: ["image_generation"],
  secret_ref: "OPENAI_API_KEY",
  apiKey: "test-key",
  endpoint: "https://api.openai.com/v1/images/generations"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("image generation provider", () => {
  it("omits the unsupported response_format parameter", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const serialized = typeof init?.body === "string" ? init.body : "";
      const body = JSON.parse(serialized) as Record<string, unknown>;
      expect(body).not.toHaveProperty("response_format");
      return new Response(
        JSON.stringify({ data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImageWithProvider(provider, "A technical project cover");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.mediaType).toBe("image/png");
    expect(new TextDecoder().decode(result.bytes)).toBe("image-bytes");
  });

  it("omits the unsupported response_format multipart field for references", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(FormData);
      expect((init?.body as FormData).get("response_format")).toBeNull();
      return new Response(
        JSON.stringify({ data: [{ b64_json: Buffer.from("edited-image").toString("base64") }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImageWithProvider(provider, "A referenced project cover", [
      { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/png", filename: "reference.png" }
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(new TextDecoder().decode(result.bytes)).toBe("edited-image");
  });
});
