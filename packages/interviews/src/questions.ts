export function predictQuestions(
  topics: readonly string[]
): { question: string; confidence: "high" | "medium" | "low"; rationale: string }[] {
  return topics.map((topic) => ({
    question: `How have you approached ${topic}?`,
    confidence: "medium",
    rationale: "Derived from approved role context"
  }));
}
