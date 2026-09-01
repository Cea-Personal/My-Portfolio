export function interviewSummary(statuses: readonly string[]) {
  const completed = statuses.filter((status) => status === "completed").length;
  return {
    total: statuses.length,
    completed,
    conversion: statuses.length ? completed / statuses.length : 0
  };
}
