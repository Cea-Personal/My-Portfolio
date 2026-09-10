import {
  generateInterviewKit,
  type AutoPreparationContext,
  type GeneratedInterviewKit
} from "@career-os/interviews";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateReasoningJson, resolveReasoningProviders } from "./reasoning-provider";
import { CAREER_OUTPUT_SCOPE_INSTRUCTION } from "./retrieval-policy";

const SYSTEM_INSTRUCTION = `${CAREER_OUTPUT_SCOPE_INSTRUCTION}
You prepare an evidence-grounded interview package for the candidate.
Return one JSON object only. Do not add experience, metrics, technologies, employer facts, or evidence IDs that are absent from the input.
Do not mention Thames Water or close variants; use supported work from that source without naming the employer. Prioritize data-engineering and data-platform examples, pipeline decisions, reliability, scale, and tools where the evidence supports them.
Use the job description, stage, CV excerpts, and approved evidence to produce practical preparation—not generic advice.
Required keys: stagePurpose, roleRequirements, likelyTopics, questions, weakAreas, companyResearch, revisionTopics, behavioralPreparation, interviewerQuestions, compensationPreparation, personalNotes, storyDrafts.
questions must be objects with question, probability (high, medium, or lower_confidence), rationale, answer, and evidenceId (a supplied approved-fact or CV-excerpt ID, or null).
Each answer must directly answer its question in the candidate's voice using the job description and only the supplied CV excerpts or approved evidence. Prefer a concise STAR structure where appropriate. Do not return generic coaching as the answer. If the source material cannot support an answer, state exactly what the candidate needs to verify instead of inventing content.
storyDrafts must be objects with title, situation, task, action, result, and evidenceIds. A missing STAR element must explicitly say what the candidate needs to verify instead of inventing it.
Question likelihood is a preparation signal, never a certainty.`;

function text(value: unknown, fallback: string, maximum = 4_000): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : fallback;
}

function strings(value: unknown, fallback: string[], maximum = 15): string[] {
  if (!Array.isArray(value)) return fallback;
  const selected = value
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim().slice(0, 500))
    .slice(0, maximum);
  return selected.length ? selected : fallback;
}

function groundedKit(
  output: Record<string, unknown>,
  baseline: GeneratedInterviewKit,
  context: AutoPreparationContext,
  provider: { provider: string; model: string; model_version: string }
): GeneratedInterviewKit {
  const documentEvidence = (context.documentContext ?? []).map((item) => ({
    factId: item.id,
    statement: item.content.slice(0, 1_500),
    problem: "Use the CV excerpt's stated context; do not infer missing details.",
    context: `Private CV context from ${item.name}.`,
    ownerContribution: "Describe only the candidate contribution stated in this CV excerpt.",
    technologies: [] as string[],
    impact: "Use only impact explicitly stated in the CV excerpt.",
    suggestedTalkingPoints: [
      "Explain the situation in your own words.",
      "Separate your contribution from the wider team's work.",
      "Keep metrics and outcomes exactly aligned with the source CV."
    ]
  }));
  const factEvidence = context.evidence.map((item) => {
    const value = item.structuredValue ?? {};
    const field = (name: string, fallback: string) => {
      const candidate = value[name];
      return typeof candidate === "string" && candidate ? candidate : fallback;
    };
    return {
      factId: item.id,
      statement: item.statement,
      problem: field("problem", "Problem or context needs candidate verification."),
      context: field("context", "Context needs candidate verification."),
      ownerContribution: field(
        "ownerContribution",
        "Describe only the contribution supported by this evidence."
      ),
      technologies: Array.isArray(value.technologies)
        ? value.technologies.filter(
            (technology): technology is string => typeof technology === "string"
          )
        : [],
      impact: field("impact", "Impact needs candidate verification."),
      suggestedTalkingPoints: [
        "Start with the supported problem and context.",
        "Explain your individual contribution.",
        "Close with the documented outcome without adding unsupported metrics."
      ]
    };
  });
  const evidenceById = new Map(
    [...factEvidence, ...documentEvidence].map((item) => [item.factId, item] as const)
  );
  const evidenceIds = new Set(evidenceById.keys());
  const questions = Array.isArray(output.questions)
    ? output.questions.slice(0, 15).flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const row = value as Record<string, unknown>;
        const question = text(row.question, "", 1_000);
        if (!question) return [];
        const probability = ["high", "medium", "lower_confidence"].includes(String(row.probability))
          ? (String(row.probability) as "high" | "medium" | "lower_confidence")
          : "lower_confidence";
        const evidenceId =
          typeof row.evidenceId === "string"
            ? row.evidenceId
            : typeof row.evidenceFactId === "string"
              ? row.evidenceFactId
              : null;
        const mappedEvidence = evidenceId ? (evidenceById.get(evidenceId) ?? null) : null;
        return [
          {
            question,
            probability,
            rationale: text(
              row.rationale,
              "Suggested from the selected stage and job requirements; this is not a prediction guarantee.",
              1_500
            ),
            answer: text(
              row.answer,
              mappedEvidence
                ? `Use this documented experience as the core of your answer: ${mappedEvidence.statement}`
                : "No grounded answer is available yet. Verify the relevant experience before answering.",
              5_000
            ),
            evidence: mappedEvidence
          }
        ];
      })
    : baseline.questions;
  const storyDrafts = Array.isArray(output.storyDrafts)
    ? output.storyDrafts.slice(0, 8).flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const row = value as Record<string, unknown>;
        const title = text(row.title, "", 300);
        const linked = Array.isArray(row.evidenceIds)
          ? row.evidenceIds.filter(
              (id): id is string => typeof id === "string" && evidenceIds.has(id)
            )
          : [];
        if (!title || !linked.length) return [];
        return [
          {
            title,
            situation: text(row.situation, "Situation needs candidate verification."),
            task: text(row.task, "Task needs candidate verification."),
            action: text(row.action, "Action needs candidate verification."),
            result: text(row.result, "Result needs candidate verification."),
            evidenceIds: linked
          }
        ];
      })
    : [];
  const strongestExperiences = [
    ...new Set(
      questions.flatMap((question) =>
        question.evidence && evidenceIds.has(question.evidence.factId)
          ? [question.evidence.factId]
          : []
      )
    )
  ];
  return {
    ...baseline,
    stagePurpose: text(output.stagePurpose, baseline.stagePurpose),
    roleRequirements: strings(output.roleRequirements, baseline.roleRequirements, 15),
    likelyTopics: strings(output.likelyTopics, baseline.likelyTopics, 15),
    questions: questions.length ? questions : baseline.questions,
    strongestExperiences,
    weakAreas: strings(output.weakAreas, baseline.weakAreas, 15),
    companyResearch: text(output.companyResearch, baseline.companyResearch),
    revisionTopics: strings(output.revisionTopics, baseline.revisionTopics, 20),
    behavioralPreparation: text(output.behavioralPreparation, baseline.behavioralPreparation),
    interviewerQuestions: strings(output.interviewerQuestions, baseline.interviewerQuestions, 12),
    compensationPreparation: text(output.compensationPreparation, baseline.compensationPreparation),
    personalNotes: text(output.personalNotes, baseline.personalNotes),
    storyDrafts,
    generation: {
      method: "llm-interview-preparation.v1",
      inputs: baseline.generation.inputs,
      evidenceCount: context.evidence.length,
      provider: provider.provider,
      model: provider.model,
      modelVersion: provider.model_version
    }
  };
}

export async function generateInterviewKitWithLlm(
  client: SupabaseClient,
  ownerId: string,
  context: AutoPreparationContext
): Promise<{
  kit: GeneratedInterviewKit;
  run: {
    providerConfigId: string;
    inputHash: string;
    outputHash: string;
    elapsedMs: number;
  };
}> {
  const baseline = generateInterviewKit(context);
  const providers = await resolveReasoningProviders(client, ownerId, "interview_preparation");
  const generated = await generateReasoningJson(
    providers,
    SYSTEM_INSTRUCTION,
    {
      job: {
        title: context.jobTitle,
        company: context.company,
        description: context.description.slice(0, 20_000)
      },
      stage: context.stage,
      approvedEvidence: context.evidence.slice(0, 100).map((item) => ({
        id: item.id,
        factType: item.factType,
        statement: item.statement.slice(0, 1_500),
        structuredValue: item.structuredValue
      })),
      cvExcerpts: (context.documentContext ?? []).slice(0, 16).map((item) => ({
        id: item.id,
        name: item.name,
        content: item.content.slice(0, 2_000)
      })),
      priorStories: (context.stories ?? []).slice(0, 12),
      groundedDraft: baseline
    },
    { task: "interview_preparation" }
  );
  return {
    kit: groundedKit(generated.output, baseline, context, generated.provider),
    run: {
      providerConfigId: generated.provider.id,
      inputHash: generated.inputHash,
      outputHash: generated.outputHash,
      elapsedMs: generated.elapsedMs
    }
  };
}
