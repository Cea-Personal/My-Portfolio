import { describe, expect, it } from "vitest";
import { getOwnerSession } from "./session";

function clientFor({ authenticated, authorized }: { authenticated: boolean; authorized: boolean }) {
  const maybeSingle = async () => ({
    data: authorized ? { user_id: "owner-id" } : null,
    error: null
  });
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle
  };
  return {
    auth: {
      getUser: async () => ({
        data: authenticated ? { user: { id: "owner-id" } } : { user: null },
        error: null
      })
    },
    schema: () => ({ from: () => query })
  };
}

describe("configured owner session", () => {
  it("rejects an authenticated account without an active owner authorization", async () => {
    await expect(
      getOwnerSession(clientFor({ authenticated: true, authorized: false }) as never)
    ).resolves.toBeNull();
  });

  it("accepts an authenticated configured owner", async () => {
    await expect(
      getOwnerSession(clientFor({ authenticated: true, authorized: true }) as never)
    ).resolves.toMatchObject({ ownerId: "owner-id" });
  });
});
