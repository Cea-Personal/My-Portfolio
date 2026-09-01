import { createHash } from "node:crypto";
import type { GenerationPort, GenerationRequest, GenerationResult } from "@career-os/ai";

export class FakeGenerationProvider implements GenerationPort {
  async generate<T>(request: GenerationRequest): Promise<GenerationResult<T>> {
    return {
      output: request.input as T,
      provider: "fake",
      model: request.model,
      modelVersion: "fake-v1",
      inputHash: createHash("sha256").update(JSON.stringify(request.input)).digest("hex"),
      schemaVersion: request.outputSchemaVersion
    };
  }
}
