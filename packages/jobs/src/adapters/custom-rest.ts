import { fetchSourceJson, type JobSourceAdapter } from "./registry";
export const customRestAdapter: JobSourceAdapter = {
  type: "custom-rest",
  version: "v1",
  capabilities: ["collect"],
  async collect(input) {
    const payload = (await fetchSourceJson(input)) as
      | readonly Record<string, unknown>[]
      | { jobs?: readonly Record<string, unknown>[]; data?: readonly Record<string, unknown>[] };
    if (Array.isArray(payload)) return payload;
    const objectPayload = payload as {
      jobs?: readonly Record<string, unknown>[];
      data?: readonly Record<string, unknown>[];
    };
    return objectPayload.jobs ?? objectPayload.data ?? [];
  }
};
