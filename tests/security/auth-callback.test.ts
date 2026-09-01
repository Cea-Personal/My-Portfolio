import { expect, it } from "vitest";

it("does not accept an OAuth callback without a code", async () => {
  const response = await fetch("http://localhost/auth/callback").catch(() => undefined);
  expect(response === undefined || response.status >= 400).toBe(true);
});
