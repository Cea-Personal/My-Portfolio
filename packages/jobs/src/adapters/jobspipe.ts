import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { contractAdapter, type JobSourceAdapter } from "./registry";
import { bearerSecret, profileQuery, recordsFromPayload, normalizedRecord } from "./api-utils";

function parseTextPayload(text: string): unknown {
  const value = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("JOBSPIPE_MCP_INVALID_RESPONSE");
  }
}

function payloadFromToolResult(result: unknown): unknown {
  if (!result || typeof result !== "object") throw new Error("JOBSPIPE_MCP_INVALID_RESPONSE");
  const record = result as Record<string, unknown>;
  if (record.isError === true) {
    const message = Array.isArray(record.content)
      ? record.content
          .flatMap((item) =>
            item && typeof item === "object" && (item as Record<string, unknown>).type === "text"
              ? [String((item as Record<string, unknown>).text ?? "")]
              : []
          )
          .join(" ")
          .trim()
      : "";
    throw new Error(`JOBSPIPE_MCP_TOOL_ERROR${message ? `:${message.slice(0, 240)}` : ""}`);
  }
  if (record.structuredContent && typeof record.structuredContent === "object") {
    return record.structuredContent;
  }
  if (!Array.isArray(record.content)) throw new Error("JOBSPIPE_MCP_INVALID_RESPONSE");
  const text = record.content.find(
    (item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "text"
  );
  if (!text || typeof (text as Record<string, unknown>).text !== "string") {
    throw new Error("JOBSPIPE_MCP_INVALID_RESPONSE");
  }
  return parseTextPayload((text as Record<string, unknown>).text as string);
}

async function callJobsPipeMcp(input: {
  endpoint: string;
  bearerToken: string;
  tool: string;
  arguments: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<unknown> {
  const client = new Client({ name: "career-os-jobspipe", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(input.endpoint), {
    requestInit: {
      headers: { authorization: `Bearer ${input.bearerToken}` }
    }
  });
  const requestOptions = input.signal
    ? { signal: input.signal, timeout: 15_000 }
    : { timeout: 15_000 };
  try {
    // The SDK transport implements the protocol client transport at runtime.
    // This cast works around an exactOptionalPropertyTypes incompatibility in
    // the SDK's exported class/interface declarations.
    await client.connect(transport as Parameters<Client["connect"]>[0], requestOptions);
    const tools = await client.listTools(undefined, requestOptions);
    if (!tools.tools.some((tool) => tool.name === input.tool)) {
      throw new Error(`JOBSPIPE_MCP_TOOL_UNAVAILABLE:${input.tool}`);
    }
    const toolRequestOptions = input.signal
      ? { signal: input.signal, timeout: 30_000 }
      : { timeout: 30_000 };
    return await client.callTool(
      { name: input.tool, arguments: input.arguments },
      undefined,
      toolRequestOptions
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

/** JobsPipe hosted MCP server (`search_jobs`). */
export const jobsPipeAdapter: JobSourceAdapter = contractAdapter({
  type: "jobspipe",
  version: "v1",
  capabilities: ["collect", "search", "pagination", "mcp"],
  async collect(input) {
    const key = bearerSecret(input) ?? process.env.JOBSPIPE_KEY;
    if (!key) throw new Error("SOURCE_CREDENTIALS_MISSING:JOBSPIPE_KEY");
    const endpoint =
      input.endpoint && !/^https:\/\/api\.jobspipe\.dev\/v1\/jobs\/search\/?$/i.test(input.endpoint)
        ? input.endpoint
        : "https://mcp.jobspipe.dev/mcp";
    const titles = [...profileQuery(input, "title"), ...profileQuery(input, "preferredTitle")];
    const locations = profileQuery(input, "location");
    const technologies = [
      ...profileQuery(input, "technology"),
      ...profileQuery(input, "preferredTechnology")
    ];
    const maxAge = Number(input.query?.maxJobAgeDays);
    const argumentsValue: Record<string, unknown> = {
      ...(titles.length ? { job_title_or: titles } : {}),
      ...(locations.length ? { job_location_or: locations } : {}),
      ...(technologies.length
        ? {
            skills_or: technologies.map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
          }
        : {}),
      ...(profileQuery(input, "workArrangement").some((value) =>
        value.toLowerCase().includes("remote")
      )
        ? { remote: true }
        : {}),
      posted_at_max_age_days: Number.isInteger(maxAge) && maxAge > 0 ? maxAge : 30,
      limit: 10,
      include_total_results: false
    };
    const result = await (input.mcpToolCaller ?? callJobsPipeMcp)({
      endpoint,
      bearerToken: key,
      tool: "search_jobs",
      arguments: argumentsValue,
      ...(input.signal ? { signal: input.signal } : {})
    });
    return recordsFromPayload(payloadFromToolResult(result), ["data", "jobs", "results"]).map(
      normalizedRecord
    );
  }
});
