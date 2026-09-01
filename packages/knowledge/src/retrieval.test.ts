import { expect, it } from "vitest";
import { lexicalSearch } from "./lexical-retrieval";
import { reciprocalRankFusion } from "./hybrid-retrieval";

it("filters private/deleted evidence before lexical or fused ranking", () => {
  const candidates = [
    { id: "public", content: "typescript systems", visibility: "public" as const },
    { id: "private", content: "typescript systems", visibility: "private" as const },
    {
      id: "deleted",
      content: "typescript systems",
      visibility: "public" as const,
      deletedAt: "now"
    }
  ];
  expect(lexicalSearch("typescript", candidates).map((item) => item.id)).toEqual(["public"]);
  expect(reciprocalRankFusion("typescript", candidates, candidates).map((item) => item.id)).toEqual(
    ["public"]
  );
});
