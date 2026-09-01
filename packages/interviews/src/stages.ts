export type InterviewStageStatus =
  | "proposed"
  | "manual"
  | "planned"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "skipped";
export interface InterviewStage {
  id: string;
  name: string;
  order: number;
  status: InterviewStageStatus;
  source: "jd" | "company" | "recruiter" | "owner" | "unknown";
}
export function reorderStages(
  stages: readonly InterviewStage[],
  ids: readonly string[]
): InterviewStage[] {
  const map = new Map(stages.map((stage) => [stage.id, stage]));
  return ids.map((id, order) => {
    const stage = map.get(id);
    if (!stage) throw new Error("STAGE_NOT_FOUND");
    return { ...stage, order };
  });
}
export function transitionStage(stage: InterviewStage, next: InterviewStageStatus): InterviewStage {
  if (stage.status === "completed" && next !== "completed")
    throw new Error("COMPLETED_STAGE_IMMUTABLE");
  return { ...stage, status: next };
}
