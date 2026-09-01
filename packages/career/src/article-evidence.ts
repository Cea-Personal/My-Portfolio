export function classifyArticleKnowledge(content: string): "technical_knowledge" | "career_proof" {
  return /I led|my role|at [A-Z][\w]+|my team/i.test(content)
    ? "career_proof"
    : "technical_knowledge";
}
export function requireArticleEvidence(content: string, evidenceIds: readonly string[]): void {
  if (classifyArticleKnowledge(content) === "career_proof" && !evidenceIds.length)
    throw new Error("CAREER_CLAIM_EVIDENCE_REQUIRED");
}
