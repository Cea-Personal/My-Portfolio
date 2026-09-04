import { deduplicationKey } from "./deduplication";
import { normalizeJob, type NormalizedJob } from "./normalization";
import type { JobSourceAdapter, JobSourceInput } from "./adapters/registry";

export interface SearchSource {
  id: string;
  adapter: JobSourceAdapter;
  input: JobSourceInput;
}

export interface SearchSourceResult {
  sourceId: string;
  status: "completed" | "failed";
  jobs: NormalizedJob[];
  attempts: number;
  fetchedCount: number;
  rejectedCount: number;
  error?: string;
}

export interface SearchRunResult {
  status: "completed" | "partial" | "failed";
  jobs: NormalizedJob[];
  sources: SearchSourceResult[];
  idempotencyKey: string;
}

export async function runSearch(
  sources: readonly SearchSource[],
  idempotencyKey: string,
  seen = new Set<string>(),
  options: { maxAttempts?: number; retryDelayMs?: number } = {}
): Promise<SearchRunResult> {
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) throw new Error("INVALID_IDEMPOTENCY_KEY");
  const maxAttempts = Math.max(1, Math.min(5, options.maxAttempts ?? 3));
  const retryDelayMs = Math.max(0, Math.min(5_000, options.retryDelayMs ?? 250));
  const results = await Promise.all(
    sources.map(async (source): Promise<SearchSourceResult> => {
      let attempts = 0;
      while (attempts < maxAttempts) {
        attempts += 1;
        try {
          const records = await source.adapter.collect(source.input);
          const jobs = records.flatMap((record) => {
            if (!record || typeof record !== "object") return [];
            const value = record as Record<string, unknown>;
            const fieldMapping = source.input.fieldMapping ?? {};
            const valueFor = (field: string): unknown => {
              if (value[field] !== undefined) return value[field];
              const mappedField = fieldMapping[field];
              if (mappedField && value[mappedField] !== undefined) return value[mappedField];
              const sourceField = Object.entries(fieldMapping).find(
                ([, target]) => target === field
              )?.[0];
              return sourceField ? value[sourceField] : undefined;
            };
            const stringValueFor = (field: string): string | undefined => {
              const candidate = valueFor(field);
              return typeof candidate === "string" ? candidate : undefined;
            };
            const company = stringValueFor("company");
            const title = stringValueFor("title");
            const location = stringValueFor("location");
            const canonicalUrl = stringValueFor("canonicalUrl");
            const description = stringValueFor("description");
            const externalId = stringValueFor("externalId");
            const normalized = normalizeJob({
              ...(company ? { company } : {}),
              ...(title ? { title } : {}),
              ...(location ? { location } : {}),
              ...(canonicalUrl ? { canonicalUrl } : {}),
              ...(description ? { description } : {}),
              ...(externalId ? { externalId } : {})
            });
            return normalized.company && normalized.title ? [normalized] : [];
          });
          return {
            sourceId: source.id,
            status: "completed",
            jobs,
            attempts,
            fetchedCount: records.length,
            rejectedCount: records.length - jobs.length
          };
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 160) : "SOURCE_FAILED";
          const nonRetryable = /^SOURCE_HTTP_4(?!08|29)/.test(message);
          if (attempts >= maxAttempts || nonRetryable)
            return {
              sourceId: source.id,
              status: "failed",
              jobs: [],
              attempts,
              fetchedCount: 0,
              rejectedCount: 0,
              error: message
            };
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempts));
        }
      }
      throw new Error("UNREACHABLE_SOURCE_RETRY_STATE");
    })
  );
  const jobsByKey = new Map<string, NormalizedJob>();
  for (const result of results) {
    for (const job of result.jobs) {
      const key = deduplicationKey(job);
      if (!seen.has(key)) {
        seen.add(key);
        jobsByKey.set(key, job);
      }
    }
  }
  const failures = results.filter((result) => result.status === "failed").length;
  return {
    status:
      failures === results.length && results.length ? "failed" : failures ? "partial" : "completed",
    jobs: [...jobsByKey.values()],
    sources: results,
    idempotencyKey
  };
}
