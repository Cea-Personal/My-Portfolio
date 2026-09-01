export interface CompensationSource {
  title: string;
  sourceUrl: string;
  observedAt: string;
  value: string;
  currency: string;
  period: string;
}
export function validateCompensationSource(source: CompensationSource): CompensationSource {
  if (!/^https:\/\//.test(source.sourceUrl)) throw new Error("HTTPS_SOURCE_REQUIRED");
  return source;
}
