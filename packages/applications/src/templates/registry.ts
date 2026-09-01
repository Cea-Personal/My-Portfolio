export const templateRegistry = ["modern", "minimal", "technical", "german", "executive"] as const;
export type TemplateName = (typeof templateRegistry)[number];
export function assertTemplate(value: string): TemplateName {
  if (!templateRegistry.includes(value as TemplateName)) throw new Error("TEMPLATE_NOT_FOUND");
  return value as TemplateName;
}
