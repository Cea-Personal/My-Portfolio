/**
 * Builds a bounded, evidence-aware interview plan from the private job context.
 *
 * This module deliberately does not invent experience, company facts, or metrics. It
 * extracts requirements from the supplied job description and only maps claims to the
 * approved evidence passed by the caller. A configured language model can replace this
 * planner later, but the deterministic fallback keeps the workflow useful and auditable.
 */

export interface InterviewEvidence {
  id: string;
  statement: string;
  factType?: string | null;
  structuredValue?: Record<string, unknown> | null;
}

export interface InterviewStory {
  id: string;
  title: string;
  situation?: string;
  task?: string;
  action?: string;
  result?: string;
  skills?: string[];
  technologies?: string[];
  evidenceIds?: string[];
}

export interface AutoPreparationContext {
  jobTitle: string;
  company: string;
  description: string;
  stage: {
    id: string;
    name: string;
    stageType: string;
  };
  evidence: readonly InterviewEvidence[];
  stories?: readonly InterviewStory[];
  documentContext?: readonly { id: string; name: string; content: string }[];
}

export interface GeneratedInterviewQuestion {
  question: string;
  probability: "high" | "medium" | "lower_confidence";
  rationale: string;
  evidence: {
    factId: string;
    statement: string;
    problem: string;
    context: string;
    ownerContribution: string;
    technologies: string[];
    impact: string;
    suggestedTalkingPoints: string[];
  } | null;
}

export interface GeneratedInterviewKit {
  stagePurpose: string;
  roleRequirements: string[];
  likelyTopics: string[];
  questions: GeneratedInterviewQuestion[];
  strongestExperiences: string[];
  projects: string[];
  achievements: string[];
  stories: string[];
  weakAreas: string[];
  companyResearch: string;
  revisionTopics: string[];
  behavioralPreparation: string;
  interviewerQuestions: string[];
  compensationPreparation: string;
  personalNotes: string;
  limitations: string[];
  generation: {
    method: "bounded-interview-planner.v1";
    inputs: string[];
    evidenceCount: number;
  };
  cvAlignment: Array<{
    documentId: string;
    documentName: string;
    matchedRequirements: string[];
    verification: "private_document_context_only";
  }>;
}

const stopWords = new Set(
  [
    "about",
    "after",
    "also",
    "and",
    "are",
    "build",
    "built",
    "from",
    "have",
    "into",
    "more",
    "role",
    "that",
    "their",
    "this",
    "through",
    "using",
    "with",
    "your"
  ].map((word) => word.toLowerCase())
);

function tokens(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [])].filter(
    (token) => !stopWords.has(token)
  );
}

function overlap(left: string, right: string): number {
  const rightTokens = new Set(tokens(right));
  return tokens(left).filter((token) => rightTokens.has(token)).length;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractRequirements(description: string, jobTitle: string): string[] {
  const lines = description
    .split(/\r?\n|[.!?]/)
    .map(clean)
    .filter((line) => line.length >= 12 && line.length <= 240)
    .filter((line) => !/^(about us|who we are|equal opportunity)/i.test(line));
  const preferred = lines.filter((line) =>
    /\b(require|experience|proficien|knowledge|ability|design|build|develop|data|cloud|platform|lead|communicat|test|security|scale)\b/i.test(
      line
    )
  );
  const requirements = [...new Set((preferred.length ? preferred : lines).map(clean))].slice(0, 12);
  return requirements.length ? requirements : [`Responsibilities for ${jobTitle}`];
}

function stageTopics(stageType: string, requirements: readonly string[]): string[] {
  const normalized = stageType.toLowerCase();
  const focus = normalized.includes("recruit")
    ? ["motivation and role fit", "scope of ownership", "availability and logistics"]
    : normalized.includes("system")
      ? ["system design and trade-offs", "reliability and scale", "operability and failure modes"]
      : normalized.includes("technical") || normalized.includes("coding")
        ? ["technical depth", "debugging and testing", "implementation trade-offs"]
        : normalized.includes("behavior") ||
            normalized.includes("hiring") ||
            normalized.includes("lead")
          ? [
              "communication and collaboration",
              "ownership and difficult decisions",
              "learning from feedback"
            ]
          : ["role expectations", "relevant experience", "working style"];
  return [...new Set([...focus, ...requirements.slice(0, 5)])].slice(0, 10);
}

function evidenceFor(
  topic: string,
  evidence: readonly InterviewEvidence[]
): InterviewEvidence | null {
  const match = [...evidence]
    .map((item) => ({
      item,
      score: overlap(topic, `${item.statement} ${JSON.stringify(item.structuredValue ?? {})}`)
    }))
    .sort((left, right) => right.score - left.score)[0];
  return match && match.score > 0 ? match.item : null;
}

function evidenceMapping(
  item: InterviewEvidence
): NonNullable<GeneratedInterviewQuestion["evidence"]> {
  const value = item.structuredValue ?? {};
  const text = (key: string, fallback: string) =>
    typeof value[key] === "string" && value[key] ? String(value[key]) : fallback;
  const technologyValue = value.technologies;
  const technologies = Array.isArray(technologyValue)
    ? technologyValue
        .filter((technology): technology is string => typeof technology === "string")
        .slice(0, 12)
    : [];
  return {
    factId: item.id,
    statement: item.statement,
    problem: text(
      "problem",
      "Problem or context is not separately documented; stay precise about what the evidence says."
    ),
    context: text("context", "Context is not separately documented."),
    ownerContribution: text(
      "ownerContribution",
      "Describe only the contribution supported by this approved fact."
    ),
    technologies,
    impact: text("impact", "Impact is not documented in this evidence."),
    suggestedTalkingPoints: [
      "Start with the problem and operating context.",
      "Explain your own contribution and the technologies you can substantiate.",
      "Close with the supported impact; do not add an unsupported metric."
    ]
  };
}

export function generateInterviewKit(context: AutoPreparationContext): GeneratedInterviewKit {
  const requirements = extractRequirements(context.description, context.jobTitle);
  const topics = stageTopics(context.stage.stageType, requirements);
  const questions = topics.map((topic, index) => {
    const evidence = evidenceFor(topic, context.evidence);
    const probability = index < 3 ? "high" : index < 7 ? "medium" : "lower_confidence";
    return {
      question:
        topic.includes("motivation") || topic.includes("role fit")
          ? `Why are you interested in ${context.jobTitle} at ${context.company}?`
          : `How would you approach ${topic} in this role?`,
      probability,
      rationale: `This is a ${probability.replace("_", " ")} preparation signal derived from the interview stage and job-description language; it is not a prediction guarantee.`,
      evidence: evidence ? evidenceMapping(evidence) : null
    } satisfies GeneratedInterviewQuestion;
  });
  const matchedIds = [
    ...new Set(
      questions.flatMap((question) => (question.evidence ? [question.evidence.factId] : []))
    )
  ];
  const weakAreas = requirements.filter(
    (requirement) => !evidenceFor(requirement, context.evidence)
  );
  const storyIds = (context.stories ?? [])
    .filter((story) => story.evidenceIds?.some((id) => matchedIds.includes(id)))
    .slice(0, 8)
    .map((story) => story.id);
  const projectIds = context.evidence
    .filter((item) => /project|case.?study|portfolio/i.test(item.factType ?? ""))
    .map((item) => item.id)
    .slice(0, 12);
  const achievementIds = context.evidence
    .filter((item) => /achievement|impact|metric|responsibilit/i.test(item.factType ?? ""))
    .map((item) => item.id)
    .slice(0, 12);
  const cvAlignment = (context.documentContext ?? [])
    .map((document) => ({
      documentId: document.id,
      documentName: document.name,
      matchedRequirements: requirements.filter(
        (requirement) => overlap(requirement, document.content) > 0
      ),
      verification: "private_document_context_only" as const
    }))
    .filter((document) => document.matchedRequirements.length > 0);
  return {
    stagePurpose: `Prepare for ${context.stage.name} in the ${context.jobTitle} process at ${context.company}.`,
    roleRequirements: requirements,
    likelyTopics: topics,
    questions,
    strongestExperiences: matchedIds,
    projects: projectIds,
    achievements: achievementIds,
    stories: storyIds,
    weakAreas,
    companyResearch:
      "Company research was not supplied in the job record. Verify the employer's own public materials before the interview.",
    revisionTopics: [...new Set([...topics, ...weakAreas])].slice(0, 15),
    behavioralPreparation:
      "Use a concise Situation–Task–Action–Result structure. Keep ownership, trade-offs, and impact tied to approved evidence.",
    interviewerQuestions: [
      "What would success look like in the first 90 days?",
      "Which technical or team constraint is most important for this role right now?",
      "How do you evaluate the quality and reliability of the systems this team owns?"
    ],
    compensationPreparation:
      "Confirm scope, location, employment model, and total-compensation components before comparing numbers. No compensation claim was inferred.",
    personalNotes:
      "Generated automatically from the selected job, its description, interview stage, and private approved evidence.",
    limitations: [
      "Question likelihood is a preparation aid, not a guarantee.",
      "No company fact, experience, project, or metric is asserted without supplied evidence.",
      ...(context.documentContext?.length
        ? [
            "CV/document excerpts are private context only and are not treated as owner-verified evidence."
          ]
        : [
            "No indexed CV/resume excerpt was available; upload and index a document for private context alignment."
          ]),
      ...(context.description.trim()
        ? []
        : [
            "This job has no description yet; add the employer-provided description for a more useful plan."
          ])
    ],
    generation: {
      method: "bounded-interview-planner.v1",
      inputs: [
        "job_description",
        "interview_stage",
        "approved_career_evidence",
        "approved_star_stories"
      ],
      evidenceCount: context.evidence.length
    },
    cvAlignment
  };
}
