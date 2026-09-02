import type { JobRequirement } from "./jd-analysis";
import type { RetrievalCandidate } from "@career-os/knowledge";
import { lexicalSearch } from "@career-os/knowledge";
import type { RequirementScore } from "./jd-score";

const STOP_WORDS = new Set(["and", "the", "with", "for", "from", "that", "this", "you", "your", "are", "will", "have", "must", "required", "preferred"]);

function terms(value: string): Set<string> {
  return new Set(
    (value.toLowerCase().match(/[a-z0-9+#.-]{2,}/g) ?? []).filter((term) => !STOP_WORDS.has(term))
  );
}

function overlap(requirement: string, content: string): number {
  const required = terms(requirement);
  if (!required.size) return 0;
  const candidate = terms(content);
  return [...required].filter((term) => candidate.has(term)).length / required.size;
}
export function matchRequirements(
  requirements: readonly JobRequirement[],
  evidence: readonly RetrievalCandidate[]
): RequirementScore[] {
  return requirements.map((requirement) => {
    const matches = lexicalSearch(requirement.text, evidence, 3);
    const bestOverlap = evidence.reduce(
      (best, candidate) =>
        candidate.visibility === "public"
          ? Math.max(best, overlap(requirement.text, candidate.content))
          : best,
      0
    );
    const outcome =
      evidence.length === 0
        ? ("insufficient_evidence" as const)
        : bestOverlap >= 0.5
          ? ("direct" as const)
          : bestOverlap >= 0.2
            ? ("transferable" as const)
            : ("unsupported" as const);
    const evidenceValue = outcome === "direct" ? 1 : outcome === "transferable" ? 0.55 : 0;
    const citations = matches.length
      ? matches.map((item) => item.id)
      : evidence
          .filter((candidate) => candidate.visibility === "public")
          .map((candidate) => ({ candidate, score: overlap(requirement.text, candidate.content) }))
          .filter((candidate) => candidate.score >= 0.2)
          .sort((left, right) => right.score - left.score)
          .slice(0, 3)
          .map(({ candidate }) => candidate.id);
    return {
      id: requirement.id,
      priority: requirement.priority,
      match: evidenceValue,
      evidence: citations,
      evidenceValue,
      outcome,
      rationale:
        outcome === "direct"
          ? "Approved public evidence directly overlaps the stated requirement."
          : outcome === "transferable"
            ? "Approved evidence demonstrates related, transferable capability but not the exact requirement."
            : outcome === "unsupported"
              ? "The public portfolio contains evidence, but none supports this requirement."
              : "No approved public evidence is available for comparison.",
      explanation: `${outcome.replace("_", " ")}: ${String(citations.length)} citation(s).`,
      category: requirement.category,
      text: requirement.text
    };
  });
}
