import {
  jobgetherAdapter,
  remoteOkAdapter,
  arbeitnowAdapter,
  adzunaAdapter,
  jsearchAdapter,
  flybyApisAdapter,
  serpApiAdapter,
  theirStackAdapter,
  jobsPipeAdapter,
  type JobSourceAdapter,
  type JobSourceInput
} from "@career-os/jobs";

const adapters: Readonly<Record<string, JobSourceAdapter>> = {
  jobgether: jobgetherAdapter,
  remoteok: remoteOkAdapter,
  arbeitnow: arbeitnowAdapter,
  adzuna: adzunaAdapter,
  jsearch: jsearchAdapter,
  flybyapis: flybyApisAdapter,
  serpapi: serpApiAdapter,
  theirstack: theirStackAdapter,
  jobspipe: jobsPipeAdapter
};

// Accept the common transposition "arbietnow" for existing records and
// manually submitted payloads, while persisting and displaying the canonical
// adapter identifier.
const sourceTypeAliases: Readonly<Record<string, string>> = {
  arbietnow: "arbeitnow"
};

export function normalizeJobSourceType(value: unknown): string {
  const type = typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
  return sourceTypeAliases[type] ?? type;
}

export const supportedJobSourceTypes = Object.keys(adapters);

export function defaultJobSourceEndpoint(type: string): string | null {
  const canonicalType = normalizeJobSourceType(type);
  return (
    {
      jobgether: "https://jobgether.com/api/v1/jobs",
      remoteok: "https://remoteok-jobs-api.p.rapidapi.com/jobs",
      arbeitnow: "https://www.arbeitnow.com/api/job-board-api",
      adzuna: "https://api.adzuna.com/v1/api/jobs/gb/search/1",
      jsearch: "https://jsearch.p.rapidapi.com/search",
      flybyapis: "https://jobs-search-api.p.rapidapi.com/jobs/search",
      serpapi: "https://serpapi.com/search.json",
      theirstack: "https://api.theirstack.com/v1/jobs/search",
      jobspipe: "https://mcp.jobspipe.dev/mcp"
    }[canonicalType] ?? null
  );
}

/** Resolve an optional form endpoint to the adapter's safe built-in preset. */
export function normalizeJobSourceEndpoint(value: unknown, type: string): string | null {
  const supplied = typeof value === "string" ? value.trim() : "";
  if (!supplied) return null;
  const canonicalType = normalizeJobSourceType(type);
  let candidate = supplied;
  if (canonicalType === "jsearch") {
    try {
      const url = new URL(candidate);
      const hostname = url.hostname.toLowerCase();
      // Owners often paste the OpenWeb Ninja documentation URL into the
      // endpoint field. Convert that page (and the short API path) to the
      // callable direct gateway instead of issuing a request to the website.
      if (
        (hostname === "www.openwebninja.com" || hostname === "openwebninja.com") &&
        /^\/api\/jsearch(?:\/docs)?\/?$/i.test(url.pathname)
      ) {
        candidate = "https://api.openwebninja.com/jsearch/search-v2";
      } else if (hostname === "api.openwebninja.com" && /^\/jsearch\/?$/i.test(url.pathname)) {
        url.pathname = "/jsearch/search-v2";
        candidate = url.toString();
      }
    } catch {
      // Let validateJobSourceEndpoint return the normal invalid-endpoint result.
    }
  }
  if (canonicalType === "adzuna") {
    try {
      const url = new URL(candidate);
      // Adzuna's documentation still shows http://:80 examples. The API is
      // available over HTTPS, so upgrade that exact public host before the
      // shared SSRF-safe endpoint validation runs.
      if (
        url.hostname.toLowerCase() === "api.adzuna.com" &&
        url.protocol === "http:" &&
        (!url.port || url.port === "80")
      ) {
        url.protocol = "https:";
        url.port = "";
        candidate = url.toString();
      }
    } catch {
      // Let validateJobSourceEndpoint return the normal invalid-endpoint result.
    }
  }
  if (canonicalType === "jobspipe") {
    try {
      const url = new URL(candidate);
      if (
        url.hostname.toLowerCase() === "api.jobspipe.dev" &&
        /^\/v1\/jobs\/search\/?$/i.test(url.pathname)
      ) {
        candidate = "https://mcp.jobspipe.dev/mcp";
      }
    } catch {
      // Let validateJobSourceEndpoint return the normal invalid-endpoint result.
    }
  }
  return validateJobSourceEndpoint(candidate);
}

export function resolveJobSourceEndpoint(value: unknown, type: string): string | null {
  return (
    normalizeJobSourceEndpoint(value, type) ??
    validateJobSourceEndpoint(defaultJobSourceEndpoint(type))
  );
}

export function getJobSourceAdapter(type: string, version: string): JobSourceAdapter | null {
  const adapter = adapters[normalizeJobSourceType(type)];
  return adapter?.version === version ? adapter : null;
}

function privateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

export function validateJobSourceEndpoint(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname === "::1" ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      hostname.startsWith("fe80:") ||
      privateIpv4(hostname)
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Validate an owner-supplied LinkedIn listing URL. This is intentionally a link
 * capture boundary: the app never requests linkedin.com or bypasses its controls.
 */
export function validateLinkedInJobUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (hostname !== "linkedin.com" && !hostname.endsWith(".linkedin.com")) ||
      !/^\/jobs\//i.test(url.pathname)
    )
      return null;
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || key.toLowerCase() === "trk")
        url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function validateSecretReference(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^[A-Z][A-Z0-9_]{2,79}$/.test(value)) return undefined;
  return value;
}

export function connectionInput(
  endpoint: string,
  secretRef: string | null,
  applicationIdRef: string | null = null
): JobSourceInput {
  const secret = secretRef ? process.env[secretRef] : undefined;
  const applicationId = applicationIdRef ? process.env[applicationIdRef] : undefined;
  return {
    endpoint,
    ...(secret ? { headers: { authorization: `Bearer ${secret}` } } : {}),
    ...(applicationId || secretRef
      ? {
          credentials: {
            ...(applicationId ? { applicationId } : {}),
            ...(secretRef ? { secretRef } : {})
          }
        }
      : {})
  };
}
