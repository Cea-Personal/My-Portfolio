import { isIP } from "node:net";

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  allowedHosts?: readonly string[];
}

function isPrivateHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (isIP(hostname) === 4) {
    const [a, b] = hostname.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && (b ?? -1) >= 16 && (b ?? -1) <= 31) ||
      (a === 192 && b === 168)
    );
  }
  return false;
}

export async function safeFetch(
  input: string | URL,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const url = new URL(input);
  if (url.protocol !== "https:" && !isPrivateHost(url.hostname))
    throw new Error("HTTPS is required for external fetches");
  if (isPrivateHost(url.hostname) && !options.allowedHosts?.includes(url.hostname))
    throw new Error("Private network target is not allowed");
  if (options.allowedHosts && !options.allowedHosts.includes(url.hostname))
    throw new Error("Host is not allowlisted");
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs ?? 10_000);
  try {
    const init: RequestInit = { ...options };
    delete (init as SafeFetchOptions).timeoutMs;
    delete (init as SafeFetchOptions).maxBytes;
    delete (init as SafeFetchOptions).maxRedirects;
    delete (init as SafeFetchOptions).allowedHosts;
    const response = await fetch(url, { ...init, redirect: "error", signal: controller.signal });
    const length = response.headers.get("content-length");
    if (length && Number(length) > (options.maxBytes ?? 10 * 1024 * 1024))
      throw new Error("Response exceeds the size limit");
    return response;
  } finally {
    clearTimeout(timer);
  }
}
