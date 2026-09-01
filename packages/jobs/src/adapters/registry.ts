export interface JobSourceAdapter {
  type: string;
  version: string;
  capabilities: readonly string[];
  collect(input: JobSourceInput): Promise<readonly unknown[]>;
}
export interface JobSourceInput {
  cursor?: string;
  endpoint?: string;
  fieldMapping?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}
const registry = new Map<string, JobSourceAdapter>();
export function registerAdapter(adapter: JobSourceAdapter): void {
  if (registry.has(`${adapter.type}@${adapter.version}`))
    throw new Error("Adapter already registered");
  registry.set(`${adapter.type}@${adapter.version}`, adapter);
}
export function getAdapter(type: string, version: string): JobSourceAdapter {
  const adapter = registry.get(`${type}@${version}`);
  if (!adapter) throw new Error("Adapter not found");
  return adapter;
}

export async function fetchSourceJson(input: JobSourceInput): Promise<unknown> {
  if (!input.endpoint) return [];
  const url = new URL(input.endpoint);
  if (url.protocol !== "https:") throw new Error("SOURCE_ENDPOINT_MUST_USE_HTTPS");
  for (const [key, value] of Object.entries(input.query ?? {}))
    url.searchParams.set(key, String(value));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const signal = input.signal
    ? AbortSignal.any([input.signal, controller.signal])
    : controller.signal;
  try {
    const response = await (input.fetcher ?? fetch)(url, {
      signal
    });
    if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 2_000_000) throw new Error("SOURCE_RESPONSE_TOO_LARGE");
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSourceText(input: JobSourceInput): Promise<string> {
  if (!input.endpoint) return "";
  const url = new URL(input.endpoint);
  if (url.protocol !== "https:") throw new Error("SOURCE_ENDPOINT_MUST_USE_HTTPS");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const signal = input.signal
    ? AbortSignal.any([input.signal, controller.signal])
    : controller.signal;
  try {
    const response = await (input.fetcher ?? fetch)(url, {
      signal
    });
    if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("SOURCE_RESPONSE_TOO_LARGE");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
