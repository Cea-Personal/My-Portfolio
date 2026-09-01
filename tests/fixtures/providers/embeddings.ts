import { createHash } from "node:crypto";

export function fakeEmbedding(
  input: string,
  dimensions = 8
): { vector: number[]; dimensions: number; modelVersion: string; inputHash: string } {
  const hash = createHash("sha256").update(input).digest();
  return {
    vector: Array.from({ length: dimensions }, (_, index) => (hash[index] ?? 0) / 255),
    dimensions,
    modelVersion: "fake-embedding-v1",
    inputHash: hash.toString("hex")
  };
}
