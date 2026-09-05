import {
  ashbyAdapter,
  customRestAdapter,
  greenhouseAdapter,
  leverAdapter,
  linkedinAuthorizedAdapter,
  jobgetherAdapter,
  remoteOkAdapter,
  rssAdapter,
  workableAdapter,
  smartRecruitersAdapter,
  teamtailorAdapter,
  personioAdapter,
  recruiteeAdapter,
  structuredAdapter,
  type JobSourceAdapter,
  type JobSourceInput
} from "@career-os/jobs";

const adapters: Readonly<Record<string, JobSourceAdapter>> = {
  ashby: ashbyAdapter,
  "custom-rest": customRestAdapter,
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  "linkedin-authorized": linkedinAuthorizedAdapter,
  jobgether: jobgetherAdapter,
  remoteok: remoteOkAdapter,
  rss: rssAdapter,
  workable: workableAdapter,
  smartrecruiters: smartRecruitersAdapter,
  teamtailor: teamtailorAdapter,
  personio: personioAdapter,
  recruitee: recruiteeAdapter,
  structured: structuredAdapter
};

export const supportedJobSourceTypes = Object.keys(adapters);

export function getJobSourceAdapter(type: string, version: string): JobSourceAdapter | null {
  const adapter = adapters[type];
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

export function connectionInput(endpoint: string, secretRef: string | null): JobSourceInput {
  const secret = secretRef ? process.env[secretRef] : undefined;
  return {
    endpoint,
    ...(secret ? { headers: { authorization: `Bearer ${secret}` } } : {})
  };
}
