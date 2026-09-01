import type { InterviewStage } from "./stages";
export function inferInterviewProcess(signals: readonly string[]): {
  confidence: "high" | "medium" | "low";
  stages: InterviewStage[];
} {
  if (!signals.length)
    return {
      confidence: "low",
      stages: [
        {
          id: crypto.randomUUID(),
          name: "Unknown process",
          order: 0,
          status: "proposed",
          source: "unknown"
        }
      ]
    };
  return {
    confidence: "medium",
    stages: signals.map((name, order) => ({
      id: crypto.randomUUID(),
      name,
      order,
      status: "proposed",
      source: "jd"
    }))
  };
}
