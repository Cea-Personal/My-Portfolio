export interface RetrievalMeasurement {
  mode: "exact" | "hnsw";
  recall: number;
  p95Ms: number;
}

export function gateApproximateIndex(measurement: RetrievalMeasurement, minRecall = 0.98): boolean {
  return measurement.recall >= minRecall && measurement.p95Ms > 0;
}
