import { verifyPublicClaim } from "../claim-verifier";
import { hybridPublicRetrieval } from "@career-os/knowledge";
import { hostilePublicInput } from "../input-safety";

const QUERY_STOP_WORDS = new Set([
  "about",
  "basil",
  "does",
  "from",
  "have",
  "has",
  "how",
  "portfolio",
  "that",
  "the",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with"
]);

const QUERY_ALIASES: Record<string, readonly string[]> = {
  built: ["build", "built", "created", "delivered", "designed", "developed", "implemented"],
  data: ["data", "etl", "ingestion", "pipeline", "platform", "warehouse"],
  impact: ["achievement", "impact", "improved", "outcome", "reduced", "result"],
  project: ["built", "initiative", "product", "project", "system"],
  projects: ["built", "initiative", "product", "project", "system"],
  skill: ["skill", "stack", "technology", "tool"],
  skills: ["skill", "stack", "technology", "tool"]
};

function queryTerms(question: string): string[] {
  return [
    ...new Set(
      question
        .toLocaleLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((term) => term.length > 2 && !QUERY_STOP_WORDS.has(term))
        .flatMap((term) => QUERY_ALIASES[term] ?? [term])
    )
  ];
}

function aggregatePublicEvidence(
  question: string,
  evidence: readonly { handle: string; text: string; source?: string }[]
): { answer: string; citations: string[] } {
  const terms = queryTerms(question);
  const ranked = evidence
    .flatMap((item, sourceIndex) =>
      item.text
        .split(/\s+—\s+|\n+|(?<=[.!?])\s+/)
        .map((fragment) => fragment.trim())
        .filter((fragment) => fragment.length >= 12)
        .map((fragment, fragmentIndex) => {
          const normalized = fragment.toLocaleLowerCase();
          const matches = terms.reduce(
            (score, term) => score + (normalized.includes(term) ? 1 : 0),
            0
          );
          return { item, fragment, matches, sourceIndex, fragmentIndex };
        })
    )
    .filter((candidate) => candidate.matches > 0)
    .sort(
      (left, right) =>
        right.matches - left.matches ||
        left.sourceIndex - right.sourceIndex ||
        left.fragmentIndex - right.fragmentIndex
    );
  const selected: typeof ranked = [];
  const normalizedFragments = new Set<string>();
  const perSource = new Map<string, number>();
  for (const candidate of ranked) {
    const normalized = candidate.fragment
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (normalizedFragments.has(normalized)) continue;
    const sourceCount = perSource.get(candidate.item.handle) ?? 0;
    if (sourceCount >= 2) continue;
    normalizedFragments.add(normalized);
    perSource.set(candidate.item.handle, sourceCount + 1);
    selected.push(candidate);
    if (selected.length >= 5) break;
  }
  if (!selected.length) {
    const first = evidence[0];
    return first
      ? { answer: first.text.slice(0, 900), citations: [first.handle] }
      : { answer: "", citations: [] };
  }
  const answer =
    selected.length === 1
      ? selected[0]!.fragment
      : `From the published portfolio:\n${selected.map((item) => `• ${item.fragment}`).join("\n")}`;
  return {
    answer,
    citations: [...new Set(selected.map((candidate) => candidate.item.handle))]
  };
}

export function answerPublicQuestion(
  question: string,
  evidence: readonly { handle: string; text: string; source?: string }[]
): { answer: string; citations: string[]; abstained: boolean } {
  const insufficientEvidence = () => "I couldn't find enough information to answer that yet.";
  if (hostilePublicInput(question))
    return {
      answer: insufficientEvidence(),
      citations: [],
      abstained: true
    };
  const byHandle = new Map(evidence.map((item) => [item.handle, item]));
  const selected = hybridPublicRetrieval(
    question,
    evidence.map((item) => ({
      id: item.handle,
      content: item.text,
      visibility: "public" as const,
      metadata: { source: item.source ?? item.handle }
    })),
    6
  ).flatMap((candidate) => {
    const match = byHandle.get(candidate.id);
    return match ? [match] : [];
  });
  const aggregated = aggregatePublicEvidence(question, selected);
  const citations = aggregated.citations;
  if (
    !question.trim() ||
    !selected.length ||
    !verifyPublicClaim(
      { statement: selected[0]?.text ?? "", evidenceHandles: citations, visibility: "public" },
      new Set(citations)
    ).verified
  )
    return {
      answer: insufficientEvidence(),
      citations: [],
      abstained: true
    };
  return { answer: aggregated.answer, citations, abstained: false };
}
