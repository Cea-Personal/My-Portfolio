export interface GenerationRequest {
  model: string;
  promptHash: string;
  input: unknown;
  outputSchemaVersion: string;
  maxTokens?: number;
}

export interface GenerationResult<T> {
  output: T;
  provider: string;
  model: string;
  modelVersion: string;
  inputHash: string;
  schemaVersion: string;
}

export interface GenerationPort {
  generate<T>(request: GenerationRequest): Promise<GenerationResult<T>>;
}
export interface EmbeddingPort {
  embed(
    input: string,
    model: string
  ): Promise<{ vector: number[]; dimensions: number; modelVersion: string; inputHash: string }>;
}
export interface RerankerPort {
  rerank(
    query: string,
    candidates: readonly string[]
  ): Promise<readonly { index: number; score: number }[]>;
}
export interface ToolProposal {
  name: string;
  arguments: Record<string, unknown>;
  requiresConfirmation: true;
}
