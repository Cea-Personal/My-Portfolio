export function careerEvidenceGap(
  requiredSkills: readonly string[],
  documentedSkills: readonly string[]
) {
  const documented = new Set(documentedSkills.map((skill) => skill.toLowerCase()));
  return requiredSkills.map((skill) => ({
    skill,
    status: documented.has(skill.toLowerCase())
      ? ("documented" as const)
      : ("undocumented" as const)
  }));
}
