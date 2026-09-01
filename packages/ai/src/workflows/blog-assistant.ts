import { requireArticleEvidence } from "@career-os/career";
export function draftBlog(
  content: string,
  evidenceIds: readonly string[]
): { content: string; evidenceIds: string[]; status: "draft" } {
  requireArticleEvidence(content, evidenceIds);
  return { content, evidenceIds: [...evidenceIds], status: "draft" };
}
