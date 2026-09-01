export interface EvidenceConnection {
  evidenceId: string;
  statement: string;
}
export interface ResumeData {
  name: string;
  headline: string;
  summary: string;
  experience: {
    title: string;
    company: string;
    bullets: string[];
    evidence: EvidenceConnection[];
  }[];
  skills: string[];
  schemaVersion: "resume.v1";
}
export interface LetterData {
  greeting: string;
  opening: string;
  connections: EvidenceConnection[];
  closing: string;
  schemaVersion: "letter.v1";
}
export function assertResumeData(data: ResumeData): ResumeData {
  if (data.experience.some((item) => item.evidence.length < 1))
    throw new Error("MATERIAL_CLAIM_UNGROUNDED");
  return data;
}
export function assertLetterConnections(data: LetterData): LetterData {
  if (data.connections.length < 2 || data.connections.length > 4)
    throw new Error("LETTER_CONNECTIONS_MUST_BE_2_TO_4");
  return data;
}
