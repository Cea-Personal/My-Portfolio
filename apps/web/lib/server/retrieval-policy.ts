/**
 * Shared retrieval boundary for generated career outputs. Raw journals,
 * analytics, and operational records may help the private Career Brain derive
 * a result, but they are not answer evidence for career-facing agents.
 */
export const CAREER_FACT_TYPES = [
  "experience",
  "project",
  "skill",
  "education",
  "certification"
] as const;

export const CAREER_DOCUMENT_KINDS = ["resume", "cover_letter"] as const;

export const PUBLIC_ASSISTANT_BLOCKED_SOURCE_TYPES = new Set([
  "journal",
  "journal_entry",
  "personal_note",
  "analytics",
  "analytics_event",
  "audit",
  "audit_event",
  "application",
  "interview",
  "compensation",
  "compensation_research"
]);

export const PUBLIC_ASSISTANT_ALLOWED_SOURCE_TYPES = new Set([
  "resume",
  "cv",
  "cover_letter",
  "document",
  "document_extraction",
  "manual",
  "manual_fact",
  "experience",
  "project",
  "skill",
  "education",
  "certification",
  "achievement",
  "blog",
  "article",
  "technical_knowledge",
  "upload",
  "drive",
  "google_drive"
]);

export const CAREER_OUTPUT_SCOPE_INSTRUCTION =
  "Use only career information (experiences, projects, skills, education, certifications, achievements, outcomes) and published technical blog content. Do not use or reveal personal journal entries, analytics, audit logs, application records, interview notes, compensation research, or other operational/private records as answer evidence.";

/** Shared employer-anonymisation boundary for every generated career output. */
export const EMPLOYER_PRIVACY_INSTRUCTION =
  'Never mention Thames Water (or close variants) as an employer, client, company, organisation, or brand. You may use verified responsibilities, achievements, technologies, outcomes, and transferable skills from that work, but anonymise the source with a neutral description such as "a utilities organisation" or "a previous employer". Never invent a replacement company name.';

export function isCareerFactType(value: unknown): value is (typeof CAREER_FACT_TYPES)[number] {
  return (
    typeof value === "string" &&
    CAREER_FACT_TYPES.includes(value as (typeof CAREER_FACT_TYPES)[number])
  );
}
