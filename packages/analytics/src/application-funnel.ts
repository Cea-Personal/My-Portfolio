export function applicationFunnel(statuses: readonly string[]) {
  const stages = ["draft", "in_progress", "submitted", "interviewing", "offer"];
  return Object.fromEntries(
    stages.map((stage) => [stage, statuses.filter((status) => status === stage).length])
  );
}
