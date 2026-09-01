export type RequirementPriority = "required" | "preferred" | "optional";
export interface JobRequirement {
  id: string;
  text: string;
  priority: RequirementPriority;
  category: "skill" | "experience" | "education" | "authorization" | "other";
  sequence: number;
}
export function extractRequirements(description: string): JobRequirement[] {
  return description
    .split(/\n|[.!?]/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, sequence) => ({
      id: `req-${sequence + 1}`,
      text,
      priority: /\b(required|must|need)\b/i.test(text)
        ? "required"
        : /\b(preferred|nice to have)\b/i.test(text)
          ? "preferred"
          : "optional",
      category: /years?|experience/i.test(text)
        ? "experience"
        : /typescript|python|react|sql|aws|docker|kubernetes/i.test(text)
          ? "skill"
          : "other",
      sequence
    }));
}
