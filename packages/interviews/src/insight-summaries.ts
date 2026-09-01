export function summarizeInterviewOutcomes(outcomes: readonly { status: string }[]) {
  const completed = outcomes.filter((item) => item.status === "completed").length;
  return {
    total: outcomes.length,
    completed,
    completionRate: outcomes.length ? completed / outcomes.length : 0,
    calculationVersion: "interviews.v1"
  };
}
