import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { schema: string; table: string; columns: string; ownerId: string }[],
  failures: new Set<string>()
}));
vi.mock("@/lib/api/private", () => ({
  withPrivateApi: (_request: Request, handler: (context: unknown) => Promise<Response>) =>
    handler({
      ownerId: "configured-owner",
      client: {
        schema: (schema: string) => ({
          from: (table: string) => {
            const query = { schema, table, columns: "", ownerId: "" };
            const chain = {
              select: (columns: string) => {
                query.columns = columns;
                return chain;
              },
              eq: (key: string, ownerId: string) => {
                if (key === "owner_id") query.ownerId = ownerId;
                return chain;
              },
              order: () => chain,
              limit: async () => {
                state.queries.push(query);
                return state.failures.has(table)
                  ? { data: null, error: { message: "database unavailable" } }
                  : { data: [], error: null };
              }
            };
            return chain;
          }
        })
      }
    })
}));

import { GET } from "./route";

const request = () =>
  new Request("http://localhost/api/v1/dashboard", {
    headers: { authorization: "Bearer unit-test-owner-session" }
  });

describe("private Today data loading", () => {
  beforeEach(() => {
    state.queries.length = 0;
    state.failures.clear();
  });

  it("scopes every query to the configured owner and loads stages through their process", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(state.queries).toHaveLength(9);
    expect(state.queries.every((query) => query.ownerId === "configured-owner")).toBe(true);
    expect(state.queries.some((query) => query.table === "interview_stages")).toBe(false);
    expect(state.queries.find((query) => query.table === "interview_processes")?.columns).toContain(
      "interview_stages("
    );
    expect(state.queries.find((query) => query.table === "portfolio_publications")?.schema).toBe(
      "published"
    );
  });

  it("reports failed sources instead of presenting them as a completed empty queue", async () => {
    state.failures.add("jobs");
    state.failures.add("interview_processes");
    const response = await GET(request());
    const payload = await response.json();
    expect(payload.data.unavailable).toEqual(expect.arrayContaining(["job matches", "interviews"]));
    expect(payload.data.actions).toEqual([]);
    expect(JSON.stringify(payload)).not.toContain("database unavailable");
  });
  it("retains the response-level authentication boundary", async () => {
    const response = await GET(new Request("http://localhost/api/v1/dashboard"));
    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.data.code).toBe("UNAUTHORIZED");
    expect(payload.data.groups).toBeUndefined();
  });
});
