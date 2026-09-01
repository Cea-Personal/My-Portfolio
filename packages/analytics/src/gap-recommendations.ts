import { careerEvidenceGap } from "./career-gap";
export function recommendGapActions(
  requiredSkills: readonly string[],
  documentedSkills: readonly string[]
) {
  return careerEvidenceGap(requiredSkills, documentedSkills)
    .filter((item) => item.status === "undocumented")
    .map((item) => ({ skill: item.skill, actions: ["document", "demonstrate", "write", "learn"] }));
}
