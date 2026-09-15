import { answerPublicQuestion, hostilePublicInput } from "@career-os/ai";
import { parsePublicEnv } from "@career-os/config";
import { createClient } from "@supabase/supabase-js";
import { issueEvidenceHandle } from "@career-os/knowledge";
import { captureSanitizedError } from "@career-os/observability";
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
  PUBLIC_CHAT_ANSWER_INSTRUCTION,
  PUBLIC_CHAT_GENERATION_BUDGET_MS,
  parsePublicChatAnswer,
  publicChatProviders,
  publicChatUnavailable
} from "@/lib/server/public-chat-answer";
import {
  PUBLIC_ASSISTANT_ALLOWED_SOURCE_TYPES,
  PUBLIC_ASSISTANT_BLOCKED_SOURCE_TYPES
} from "@/lib/server/retrieval-policy";

export const maxDuration = 120;

type PublicChatResult = ReturnType<typeof answerPublicQuestion> & {
  citationLabels?: string[];
  unavailable?: boolean;
};

const PUBLIC_ANSWER_CACHE_TTL_MS = 5 * 60 * 1_000;
const PUBLIC_ANSWER_CACHE_MAX_ENTRIES = 100;
const PUBLIC_ANSWER_CACHE_VERSION = "conversational-v2";
const PUBLIC_VECTOR_CACHE_TTL_MS = 2 * 60 * 1_000;
const PUBLIC_VECTOR_CACHE_MAX_ENTRIES = 200;
const PUBLIC_CHAT_ENABLE_RERANKER = process.env.PUBLIC_CHAT_ENABLE_RERANKER === "true";
const publicAnswerCache = new Map<string, { expiresAt: number; result: PublicChatResult }>();
const publicVectorCache = new Map<
  string,
  {
    expiresAt: number;
    evidence: { handle: string; text: string; source?: string; semantic: true }[];
  }
>();

/** Keep an optional provider from blocking the public portfolio indefinitely. */
function withTimeout<T>(operation: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };
    timer = setTimeout(() => finish(fallback), timeoutMs);
    operation.then(finish).catch(() => finish(fallback));
  });
}

function readCachedPublicAnswer(key: string): PublicChatResult | null {
  const entry = publicAnswerCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    publicAnswerCache.delete(key);
    return null;
  }
  return entry.result;
}

function cachePublicAnswer(key: string, result: PublicChatResult): void {
  if (publicAnswerCache.size >= PUBLIC_ANSWER_CACHE_MAX_ENTRIES) {
    const oldest = publicAnswerCache.keys().next().value;
    if (typeof oldest === "string") publicAnswerCache.delete(oldest);
  }
  publicAnswerCache.set(key, { expiresAt: Date.now() + PUBLIC_ANSWER_CACHE_TTL_MS, result });
}

function readCachedVectorEvidence(
  key: string
): { handle: string; text: string; source?: string; semantic: true }[] | null {
  const entry = publicVectorCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    publicVectorCache.delete(key);
    return null;
  }
  return entry.evidence;
}

function cacheVectorEvidence(
  key: string,
  evidence: { handle: string; text: string; source?: string; semantic: true }[]
): void {
  if (publicVectorCache.size >= PUBLIC_VECTOR_CACHE_MAX_ENTRIES) {
    const oldest = publicVectorCache.keys().next().value;
    if (typeof oldest === "string") publicVectorCache.delete(oldest);
  }
  publicVectorCache.set(key, { expiresAt: Date.now() + PUBLIC_VECTOR_CACHE_TTL_MS, evidence });
}

function directPublicProfileAnswer(
  question: string,
  publication: Record<string, unknown> | null
): PublicChatResult | null {
  if (!/\b(?:what is|what's|who is)\s+(?:my|your)\s+name\b|\bwho am i\b/i.test(question))
    return null;
  const configuredName =
    publication && typeof publication.display_name === "string"
      ? publication.display_name.trim()
      : "";
  const name = configuredName || "Basil Ogbonna";
  const publicationId = typeof publication?.id === "string" ? publication.id : "public-profile";
  const profileHandle = issueEvidenceHandle({
    chunkId: `public-profile:${publicationId}`,
    sourceVersionHash:
      typeof publication?.content_hash === "string" ? publication.content_hash : publicationId,
    start: 0,
    end: name.length
  });
  return {
    answer: `Your name is ${name}.`,
    citations: [profileHandle],
    citationLabels: ["Public profile"],
    abstained: false
  };
}

function directSmallTalkAnswer(question: string): PublicChatResult | null {
  if (!/^(?:hi|hello|hey)(?:\s+(?:there|basil))?[!.?\s]*$/i.test(question)) return null;
  return {
    answer:
      "Hello! I’m Ask Basil, the portfolio assistant. Ask me about Basil’s experience, projects, skills, or engineering approach.",
    citations: [],
    citationLabels: [],
    abstained: false
  };
}

function isPortfolioQuestion(question: string): boolean {
  const portfolioSignal =
    /\b(?:basil|my|your|portfolio|career|experience|projects?|roles?|resume|cv|github|linkedin|achievements?|outcomes?|skills?|worked|built)\b/i.test(
      question
    );
  const generalDefinition =
    /^(?:what is|what are|define|explain|how does|how do|why does|why do)\b/i.test(question) &&
    !portfolioSignal;
  return portfolioSignal && !generalDefinition;
}

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
  client: ReturnType<typeof publicRuntimeClient>,
  revision: string
): Promise<{ handle: string; text: string; source?: string; semantic: true }[]> {
  try {
    const cacheKey = `${ownerId}:${revision}:${question.toLocaleLowerCase().replace(/\s+/g, " ").trim()}`;
    const cached = readCachedVectorEvidence(cacheKey);
    if (cached) return cached;
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
    // Reranking improves precision when available, but it must not make a
    // public visitor wait on a second remote model. Preserve vector order on
    // timeout or provider failure.
    const reranked = PUBLIC_CHAT_ENABLE_RERANKER
      ? await withTimeout(
          rerankCandidates(client, ownerId, question, candidates, 8),
          2_500,
          candidates.slice(0, 8)
        )
      : candidates.slice(0, 8);
    const evidence = reranked.flatMap((item) => {
      const handle = issueEvidenceHandle({
        chunkId: item.publicEvidenceId,
        sourceVersionHash: item.sourceVersionHash,
        start: 0,
        end: item.excerpt.length
      });
      return [{ handle, text: item.excerpt, source: item.source, semantic: true as const }];
    });
    cacheVectorEvidence(cacheKey, evidence);
    return evidence;
  } catch {
    // Public item retrieval and lexical retrieval remain available when the
    // configured embedding provider or public vector RPC is unavailable.
    return [];
  }
}

async function composeGroundedAnswer(
  question: string,
  result: ReturnType<typeof answerPublicQuestion>,
  evidence: readonly { handle: string; text: string; source?: string; semantic?: boolean }[],
  ownerId: string
): Promise<PublicChatResult> {
  try {
    const providers = await resolveReasoningProviders(publicRuntimeClient(), ownerId, "public_qa");
    const boundedProviders = publicChatProviders(providers);
    const cited = new Set(result.citations);
    // Use lexical hits first, then a compact slice of the published snapshot
    // so the configured model can understand synonyms without receiving a
    // huge prompt that dilutes the relevant facts and increases latency.
    // If lexical/semantic retrieval found nothing, do not feed unrelated
    // vector hits to the model; that is how an identity question can drift
    // into an unrelated project. The model may still use published summaries.
    const groundedEvidence = result.citations.length
      ? evidence
      : evidence.filter((item) => item.semantic !== true);
    const context = [
      ...groundedEvidence.filter((item) => cited.has(item.handle)),
      ...groundedEvidence.filter((item) => !cited.has(item.handle))
    ]
      .filter(
        (item, index, values) =>
          values.findIndex(
            (candidate) => candidate.handle === item.handle || candidate.text === item.text
          ) === index
      )
      .slice(0, 8)
      .map((item, index) => ({
        id: `S${index + 1}`,
        handle: item.handle,
        source: item.source ?? "Portfolio",
        text: item.text.slice(0, 2_800)
      }));
    if (!context.length)
      return parsePublicChatAnswer({ answer: "No information", status: "abstained" }, []);
    const generated = await generateReasoningJson(
      boundedProviders,
      PUBLIC_CHAT_ANSWER_INSTRUCTION,
      {
        question,
        mode: "retrieved_context",
        context: context.map(({ handle: _handle, ...source }) => source)
      },
      { task: "public_qa" }
    );
    return parsePublicChatAnswer(generated.output, context);
  } catch (error) {
    captureSanitizedError(error, { route: "/api/v1/public/chat", stage: "compose_answer" });
    // Retrieved CV fragments are context, not a substitute for an AI answer.
    return publicChatUnavailable();
  }
}

async function composeGeneralAnswer(question: string, ownerId: string): Promise<PublicChatResult> {
  try {
    const providers = await resolveReasoningProviders(publicRuntimeClient(), ownerId, "public_qa");
    const boundedProviders = publicChatProviders(providers);
    const generated = await generateReasoningJson(
      boundedProviders,
      [
        "You are Ask Basil, a helpful conversational assistant.",
        "This is a general question, not a request for Basil's private or portfolio information.",
        "Answer clearly and naturally using your general knowledge.",
        "Do not make claims about Basil and do not call any tools for this request.",
        "Return JSON only with answer, sources, confidence, status, and message. Use an empty sources array."
      ].join("\n"),
      { question, mode: "general" },
      { task: "public_qa" }
    );
    const answer =
      typeof generated.output.answer === "string" ? generated.output.answer.trim() : "";
    if (!answer) throw new Error("GENERAL_ANSWER_EMPTY");
    return { answer, citations: [], abstained: false };
  } catch (error) {
    captureSanitizedError(error, { route: "/api/v1/public/chat", stage: "general_answer" });
    return publicChatUnavailable();
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
  const smallTalkAnswer = directSmallTalkAnswer(question);
  if (smallTalkAnswer) {
    if (request.headers.get("accept")?.includes("text/event-stream"))
      return streamResponse(smallTalkAnswer, request, request.headers.get("last-event-id"));
    return publicApiResponse(smallTalkAnswer, request, 200);
  }
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
  const ownerId =
    typeof snapshot.publication?.owner_id === "string" ? snapshot.publication.owner_id : "";
  const publicationRevision =
    typeof snapshot.publication?.content_hash === "string"
      ? snapshot.publication.content_hash
      : typeof snapshot.publication?.updated_at === "string"
        ? snapshot.publication.updated_at
        : typeof snapshot.publication?.id === "string"
          ? snapshot.publication.id
          : "public";
  const cacheKey = [
    PUBLIC_ANSWER_CACHE_VERSION,
    ownerId || "public",
    publicationRevision,
    question.toLocaleLowerCase().replace(/\s+/g, " ").trim()
  ].join(":");
  const cached = readCachedPublicAnswer(cacheKey);
  if (cached) {
    if (request.headers.get("accept")?.includes("text/event-stream"))
      return streamResponse(cached, request, request.headers.get("last-event-id"));
    return publicApiResponse(cached, request, cached.abstained ? 200 : 201);
  }
  const directProfileAnswer = directPublicProfileAnswer(question, snapshot.publication);
  if (directProfileAnswer) {
    cachePublicAnswer(cacheKey, directProfileAnswer);
    if (request.headers.get("accept")?.includes("text/event-stream"))
      return streamResponse(directProfileAnswer, request, request.headers.get("last-event-id"));
    return publicApiResponse(directProfileAnswer, request, 201);
  }
  if (!isPortfolioQuestion(question)) {
    const generalAnswer = ownerId
      ? await withTimeout(
          composeGeneralAnswer(question, ownerId),
          PUBLIC_CHAT_GENERATION_BUDGET_MS + 5_000,
          publicChatUnavailable()
        )
      : {
          answer:
            "I can help with general questions, but the assistant is temporarily unavailable.",
          citations: [],
          abstained: true
        };
    if (generalAnswer.answer && !generalAnswer.abstained)
      cachePublicAnswer(cacheKey, generalAnswer);
    if (request.headers.get("accept")?.includes("text/event-stream"))
      return streamResponse(generalAnswer, request, request.headers.get("last-event-id"));
    return publicApiResponse(generalAnswer, request, generalAnswer.abstained ? 200 : 201);
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
  const publishedProfileEvidence = (() => {
    const publication = snapshot.publication;
    const publicId = typeof publication?.id === "string" ? publication.id : "";
    const profileText = [publication?.display_name, publication?.headline, publication?.bio]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => expandTechnologyTerms(value.trim()))
      .join("\n");
    if (!publicId || !profileText) return [];
    const handle = issueEvidenceHandle({
      chunkId: `public-profile:${publicId}`,
      sourceVersionHash:
        typeof publication?.content_hash === "string" ? publication.content_hash : publicId,
      start: 0,
      end: profileText.length
    });
    return [{ handle, text: profileText, source: "Public profile" }];
  })();
  const client = ownerId ? publicRuntimeClient() : null;
  const vectorEvidence = client
    ? await withTimeout(
        retrievePublicVectorEvidence(ownerId, question, client, publicationRevision),
        6_000,
        []
      )
    : [];
  // Semantic hits are preferred. If no close vector exists, the deterministic
  // fallback is limited to already-published career and blog content; it never
  // expands into private journals, analytics, or other private sources.
  const allEvidence = vectorEvidence.length
    ? [
        ...vectorEvidence,
        ...publishedProfileEvidence,
        ...publishedItemEvidence,
        ...publishedBlogEvidence,
        ...evidence
      ]
    : [
        ...publishedProfileEvidence,
        ...publishedItemEvidence,
        ...publishedBlogEvidence,
        ...evidence
      ];
  const retrieved = answerPublicQuestion(question, allEvidence);
  const result =
    ownerId && allEvidence.length
      ? await withTimeout(
          composeGroundedAnswer(question, retrieved, allEvidence, ownerId),
          PUBLIC_CHAT_GENERATION_BUDGET_MS + 5_000,
          publicChatUnavailable()
        )
      : publicChatUnavailable();
  const safeResult = anonymizeEmployerReferences(result) as PublicChatResult;
  const sourceByHandle = new Map(allEvidence.map((item) => [item.handle, item.source]));
  const responseResult = {
    ...safeResult,
    answer: expandTechnologyTerms(safeResult.answer),
    citationLabels: safeResult.citations.map(
      (handle) => sourceByHandle.get(handle) ?? "Published portfolio"
    )
  };
  if (responseResult.answer && !responseResult.abstained && !responseResult.unavailable) {
    cachePublicAnswer(cacheKey, responseResult);
  }
  if (request.headers.get("accept")?.includes("text/event-stream"))
    return streamResponse(responseResult, request, request.headers.get("last-event-id"));
  return publicApiResponse(responseResult, request, safeResult.abstained ? 200 : 201);
}
