export type DocumentKind = "resume" | "cover_letter" | "other";

export interface DocumentClassification {
  kind: DocumentKind;
  confidence: number;
  reason: string;
}

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function classifyCareerDocument(name: string, content: string): DocumentClassification {
  const filename = normalized(name.replace(/\.[a-z0-9]{1,8}$/i, ""));
  const sample = normalized(content.slice(0, 20_000));
  const coverFilename = /\b(cover|covering|motivation)[-_ ]?(letter)?\b/.test(filename);
  const coverGreeting = /\bdear (?:hr|recruiter|hiring manager|sir|madam|[a-z]+ team)\b/.test(
    sample
  );
  const coverIntent =
    /\b(?:i am|i'm) (?:writing|excited) to apply\b|\bapplication for the (?:role|position)\b/.test(
      sample
    );
  const coverClosing = /\b(?:yours sincerely|yours faithfully|kind regards|sincerely)\b/.test(
    sample
  );
  const coverScore =
    Number(coverFilename) * 3 + Number(coverGreeting) + Number(coverIntent) + Number(coverClosing);
  const resumeFilename = /\b(cv|resume|curriculum vitae)\b/.test(filename);
  const experienceHeading = /\b(?:work |professional |career )?experience\b/.test(sample);
  const skillHeading = /\b(?:technical |core )?skills\b/.test(sample);
  const educationHeading = /\beducation\b/.test(sample);
  const resumeScore =
    Number(resumeFilename) * 3 +
    Number(experienceHeading) +
    Number(skillHeading) +
    Number(educationHeading);

  if (coverScore >= 3 && coverScore >= resumeScore) {
    return {
      kind: "cover_letter",
      confidence: Math.min(0.99, 0.7 + coverScore * 0.06),
      reason: coverFilename ? "cover-letter filename and content signals" : "cover-letter wording"
    };
  }
  if (resumeScore >= 3) {
    return {
      kind: "resume",
      confidence: Math.min(0.99, 0.68 + resumeScore * 0.06),
      reason: resumeFilename
        ? "CV/resume filename and section signals"
        : "CV/resume section structure"
    };
  }
  return { kind: "other", confidence: 0.5, reason: "no decisive CV or cover-letter signals" };
}
