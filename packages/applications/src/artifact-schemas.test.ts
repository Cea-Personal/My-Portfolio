import { expect, it } from "vitest";
import { assertLetterConnections } from "./artifact-schemas";
it("requires two to four evidence connections in a letter", () => {
  expect(() =>
    assertLetterConnections({
      greeting: "Hi",
      opening: "Hello",
      connections: [],
      closing: "Thanks",
      schemaVersion: "letter.v1"
    })
  ).toThrow();
});
