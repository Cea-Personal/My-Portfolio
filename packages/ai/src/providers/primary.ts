import type { GenerationPort, GenerationRequest, GenerationResult } from "../ports";
export class PrimaryProvider implements GenerationPort {
  async generate<T>(request: GenerationRequest): Promise<GenerationResult<T>> {
    return {
      output: request.input as T,
      provider: "primary",
      model: request.model,
      modelVersion: "primary-v1",
      inputHash: request.promptHash,
      schemaVersion: request.outputSchemaVersion
    };
  }
}
