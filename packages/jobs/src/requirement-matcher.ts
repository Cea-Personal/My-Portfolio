import type { JobRequirement } from "./jd-analysis";
import type { RetrievalCandidate } from "@career-os/knowledge";
import { lexicalSearch } from "@career-os/knowledge";
import type { RequirementScore } from "./jd-score";
export function matchRequirements(
  requirements: readonly JobRequirement[],
  evidence: readonly RetrievalCandidate[]
): RequirementScore[] {
  return requirements.map((requirement) => {
    const matches = lexicalSearch(requirement.text, evidence, 3);
    const evidenceValue = matches.length ? Math.min(1, matches.length / 3) : 0;
    return {
      id: requirement.id,
      priority: requirement.priority,
      match: evidenceValue,
      evidence: matches.map((item) => item.id),
      evidenceValue,
      explanation: matches.length
        ? `${matches.length} approved public evidence item${matches.length === 1 ? "" : "s"} matched.`
        : "No approved public evidence found.",
      category: requirement.category,
      text: requirement.text
    };
  });
}
