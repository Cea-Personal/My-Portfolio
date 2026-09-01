import type { ResumeData } from "./artifact-schemas";
export function composeResume(input: Omit<ResumeData, "schemaVersion">): ResumeData {
  return { ...input, schemaVersion: "resume.v1" };
}
