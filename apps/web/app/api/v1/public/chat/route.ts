import { answerPublicQuestion, hostilePublicInput } from "@career-os/ai";
import { parsePublicEnv } from "@career-os/config";
import { createClient } from "@supabase/supabase-js";
import { issueEvidenceHandle } from "@career-os/knowledge";
import { allowPublicAiRequest } from "@/lib/public-ai-rate-limit";
import { loadPublicBlogPostsWithStatus, loadPublicPortfolio } from "@/lib/api/public-data";
import { publicApiResponse } from "@/lib/api/response";
import { embedWithFallback, resolveEmbeddingProviders } from "@/lib/server/embedding-provider";
import {
  anonymizeEmployerReferences,
  generateReasoningJson,
  resolveReasoningProviders
} from "@/lib/server/reasoning-provider";
import { rerankCandidates } from "@/lib/server/reranker-provider";
import { publicPortfolioItemContext } from "@/lib/public-assistant-context";
import { expandTechnologyTerms } from "@/lib/portfolio-career-rules";
import {
  CAREER_OUTPUT_SCOPE_INSTRUCTION,
  EMPLOYER_PRIVACY_INSTRUCTION,
  PUBLIC_ASSISTANT_ALLOWED_SOURCE_TYPES,
  PUBLIC_ASSISTANT_BLOCKED_SOURCE_TYPES
} from "@/lib/server/retrieval-policy";

export const maxDuration = 120;

function requestKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
}

function publicRuntimeClient() {
  const env = parsePublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

async function retrievePublicVectorEvidence(
  ownerId: string,
  question: string,
  client: ReturnType<typeof publicRuntimeClient>
): Promise<{ handle: string; text: string; source?: string }[]> {
  try {
    const providers = await resolveEmbeddingProviders(client, ownerId);
    const embedded = await embedWithFallback(providers, [question]);
    const vector = embedded.vectors[0];
    if (!vector) return [];
    const { data, error } = await client.schema("app").rpc("match_public_evidence", {
      requested_embedding: `[${vector.join(",")}]`,
      requested_provider: embedded.provider.provider,
      requested_model: embedded.provider.model,
      requested_model_version: embedded.provider.model_version ?? "",
      requested_limit: 8,
      requested_min_similarity: 0.2
    });
    if (error || !Array.isArray(data)) return [];
    const candidates = data.flatMap((row: unknown) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>;
      const publicEvidenceId =
        typeof item.public_evidence_id === "string" ? item.public_evidence_id : "";
      const excerpt = expandTechnologyTerms(
        typeof item.sanitized_excerpt === "string" ? item.sanitized_excerpt.trim() : ""
      );
      if (!publicEvidenceId || !excerpt) return [];
      return [
        {
          publicEvidenceId,
          excerpt,
          sourceVersionHash:
            typeof item.source_version_hash === "string" ? item.source_version_hash : "public",
          source: typeof item.safe_title === "string" ? item.safe_title : publicEvidenceId,
          content: excerpt
        }
      ];
    });
    const reranked = await rerankCandidates(client, ownerId, question, candidates, 8);
    return reranked.flatMap((item) => {
      const handle = issueEvidenceHandle({
        chunkId: item.publicEvidenceId,
        sourceVersionHash: item.sourceVersionHash,
        start: 0,
        end: item.excerpt.length
      });
      return [{ handle, text: item.excerpt, source: item.source }];
    });
  } catch {
    // Public item retrieval and lexical retrieval remain available when the
    // configured embedding provider or public vector RPC is unavailable.
    return [];
  }
}

async function composeGroundedAnswer(
  question: string,
  result: ReturnType<typeof answerPublicQuestion>,
  evidence: readonly { handle: string; text: string; source?: string }[],
  ownerId: string
): Promise<ReturnType<typeof answerPublicQuestion>> {
  try {
    const providers = await resolveReasoningProviders(publicRuntimeClient(), ownerId, "public_qa");
    const cited = new Set(result.citations);
    // Use lexical hits first, then a bounded slice of the published snapshot
    // so the configured model can understand synonyms and conversational
    // questions that do not share exact words with a portfolio item.
    const context = [
      ...evidence.filter((item) => cited.has(item.handle)),
      ...evidence.filter((item) => !cited.has(item.handle))
    ]
      .filter(
        (item, index, values) =>
          values.findIndex(
            (candidate) => candidate.handle === item.handle || candidate.text === item.text
          ) === index
      )
      .slice(0, 12)
      .map((item) => ({
        handle: item.handle,
        source: item.source ?? "Portfolio",
        text: item.text.slice(0, 5_000)
      }));
    if (!context.length) return result;
    const generated = await generateReasoningJson(
      providers,
      [
        "You are Ask Basil, a public portfolio assistant.",
        CAREER_OUTPUT_SCOPE_INSTRUCTION,
        EMPLOYER_PRIVACY_INSTRUCTION,
        "Answer the visitor's question using only the supplied published portfolio context.",
        "Aggregate the relevant facts across context entries, then answer the exact question directly in concise, natural prose.",
        "Prefer 1-3 short paragraphs or a compact list when the question asks for several examples. Do not dump or repeat the full context.",
        "Do not invent employers, dates, metrics, tools, projects, or personal details.",
        "Use Lead Software Engineer as the Bloom Institute of Technology role title; do not describe it as Technical Team Lead.",
        "Wheretocode and Lambdadoor are professional team projects. Describe Basil's public project relationship as Contributor and answer with the supported work he contributed, without labelling either project personal.",
        "The sources array must contain only exact evidence handles from the supplied context.",
        "If the context does not support an answer, return an empty sources array and say you could not find enough information to answer that yet.",
        "Return JSON only with answer, sources, confidence, status, and message."
      ].join("\n"),
      { question, context },
      { task: "public_qa" }
    );
    const answer =
      typeof generated.output.answer === "string" ? generated.output.answer.trim() : "";
    const allowedHandles = new Set(context.map((item) => item.handle));
    const sources = Array.isArray(generated.output.sources)
      ? generated.output.sources.filter(
          (value): value is string => typeof value === "string" && allowedHandles.has(value)
        )
      : [];
    if (!answer || !sources.length) return result;
    return { answer, citations: sources, abstained: false };
  } catch {
    // A provider outage must not prevent the public portfolio from answering
    // from the already retrieved, published context.
    return result;
  }
}

function streamResponse(
  result: ReturnType<typeof answerPublicQuestion> & { unavailable?: boolean },
  request: Request,
  lastEventId: string | null
): Response {
  const encoder = new TextEncoder();
  const previousStreamId = lastEventId?.split(":", 1)[0];
  const streamId = previousStreamId || crypto.randomUUID();
  const resumeAfter = lastEventId?.endsWith(":1") ? 1 : 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (resumeAfter < 1)
        controller.enqueue(
          encoder.encode(`event: message\nid: ${streamId}:1\ndata: ${JSON.stringify(result)}\n\n`)
        );
      controller.enqueue(
        encoder.encode(`event: done\nid: ${streamId}:2\ndata: ${JSON.stringify({ streamId })}\n\n`)
      );
      controller.close();
    }
  });
  const response = new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "retry-after": "1",
      "x-stream-id": streamId,
      "x-correlation-id": request.headers.get("x-correlation-id") ?? crypto.randomUUID()
    }
  });
  return response;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const key = requestKey(request);
  if (!allowPublicAiRequest(`chat:${key}`, 30))
    return publicApiResponse(
      { code: "RATE_LIMITED", detail: "Please try again later." },
      request,
      429
    );
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 2000) : "";
  if (!question || hostilePublicInput(question))
    return publicApiResponse(
      {
        answer: "I can only answer career questions from the facts shared in this portfolio.",
        citations: [],
        abstained: true,
        reason: !question ? "EMPTY_QUESTION" : "UNSAFE_INSTRUCTION"
      },
      request,
      400
    );
  const [snapshot, blogSnapshot] = await Promise.all([
    loadPublicPortfolio(),
    loadPublicBlogPostsWithStatus()
  ]);
  if (snapshot.source !== "live") {
    const unavailable = {
      answer: "The public assistant is temporarily unavailable while portfolio facts reconnect.",
      citations: [] as string[],
      abstained: true,
      unavailable: true
    };
    if (request.headers.get("accept")?.includes("text/event-stream"))
      return streamResponse(unavailable, request, request.headers.get("last-event-id"));
    return publicApiResponse(unavailable, request, 200);
  }
  const evidence = snapshot.evidence.flatMap((item) => {
    const evidenceType =
      typeof item.evidence_type === "string" ? item.evidence_type.trim().toLowerCase() : "";
    if (
      !PUBLIC_ASSISTANT_ALLOWED_SOURCE_TYPES.has(evidenceType) ||
      PUBLIC_ASSISTANT_BLOCKED_SOURCE_TYPES.has(evidenceType)
    )
      return [];
    const text = expandTechnologyTerms(
      typeof item.sanitized_excerpt === "string" ? item.sanitized_excerpt : ""
    );
    if (!text || typeof item.public_evidence_id !== "string") return [];
    const handle = issueEvidenceHandle({
      chunkId: item.public_evidence_id,
      sourceVersionHash:
        typeof item.source_version_hash === "string" ? item.source_version_hash : "",
      start: 0,
      end: text.length
    });
    return [
      {
        handle,
        text,
        source: typeof item.safe_title === "string" ? item.safe_title : item.public_evidence_id
      }
    ];
  });
  // Published portfolio items are also owner-approved public context. Include
  // their summaries in retrieval so Ask Basil can answer from the same visible
  // experiences, projects, skills, and profile content that visitors can read.
  // This remains strictly inside the public publication; private Career Brain
  // facts, source documents, and private vectors are never exposed here.
  const publishedItemEvidence = snapshot.items.flatMap((item) => {
    const section = typeof item.section === "string" ? item.section.trim().toLowerCase() : "";
    if (!["about", "experience", "projects", "credentials", "blog", "profile"].includes(section))
      return [];
    const publicId = typeof item.public_id === "string" ? item.public_id : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const summary = typeof item.public_summary === "string" ? item.public_summary.trim() : "";
    if (!publicId || !summary) return [];
    const text = publicPortfolioItemContext(item);
    if (!text) return [];
    const handle = issueEvidenceHandle({
      chunkId: `public-item:${publicId}`,
      sourceVersionHash:
        typeof snapshot.publication?.content_hash === "string"
          ? snapshot.publication.content_hash
          : "public-publication",
      start: 0,
      end: text.length
    });
    return [{ handle, text, source: title || publicId }];
  });
  const publishedBlogEvidence =
    blogSnapshot.source === "live"
      ? blogSnapshot.posts.flatMap((post) => {
          const text = [post.title, post.excerpt, post.markdown.slice(0, 8_000)]
            .filter(Boolean)
            .join("\n\n");
          if (!text.trim()) return [];
          const handle = issueEvidenceHandle({
            chunkId: `public-blog:${post.id}`,
            sourceVersionHash: post.id,
            start: 0,
            end: text.length
          });
          return [{ handle, text, source: `Blog · ${post.title}` }];
        })
      : [];
  const ownerId =
    typeof snapshot.publication?.owner_id === "string" ? snapshot.publication.owner_id : "";
  const client = ownerId ? publicRuntimeClient() : null;
  const vectorEvidence = client
    ? await retrievePublicVectorEvidence(ownerId, question, client)
    : [];
  // Semantic hits are preferred. If no close vector exists, the deterministic
  // fallback is limited to already-published career and blog content; it never
  // expands into private journals, analytics, or other private sources.
  const allEvidence = vectorEvidence.length
    ? [...vectorEvidence, ...publishedItemEvidence, ...publishedBlogEvidence, ...evidence]
    : [...publishedItemEvidence, ...publishedBlogEvidence, ...evidence];
  const retrieved = answerPublicQuestion(question, allEvidence);
  const result =
    ownerId && allEvidence.length
      ? await composeGroundedAnswer(question, retrieved, allEvidence, ownerId)
      : retrieved;
  const safeResult = anonymizeEmployerReferences(result) as ReturnType<typeof answerPublicQuestion>;
  const sourceByHandle = new Map(allEvidence.map((item) => [item.handle, item.source]));
  const responseResult = {
    ...safeResult,
    answer: expandTechnologyTerms(safeResult.answer),
    citationLabels: safeResult.citations.map(
      (handle) => sourceByHandle.get(handle) ?? "Published portfolio"
    )
  };
  if (request.headers.get("accept")?.includes("text/event-stream"))
    return streamResponse(responseResult, request, request.headers.get("last-event-id"));
  return publicApiResponse(responseResult, request, safeResult.abstained ? 200 : 201);
}
