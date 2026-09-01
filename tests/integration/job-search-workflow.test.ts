import { expect, it } from "vitest";
import { ashbyAdapter } from "@career-os/jobs";

it("treats an empty adapter response as a successful partial run", async () => {
  expect(await ashbyAdapter.collect({})).toEqual([]);
});
