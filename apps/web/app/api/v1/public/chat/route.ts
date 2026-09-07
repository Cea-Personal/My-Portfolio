import { answerPublicQuestion, hostilePublicInput } from "@career-os/ai";
import { issueEvidenceHandle } from "@career-os/knowledge";
import { allowPublicAiRequest } from "@/lib/public-ai-rate-limit";
import { loadPublicPortfolio } from "@/lib/api/public-data";
import { publicApiResponse } from "@/lib/api/response";

function requestKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
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
  const snapshot = await loadPublicPortfolio();
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
    const text = typeof item.sanitized_excerpt === "string" ? item.sanitized_excerpt : "";
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
  const result = answerPublicQuestion(question, evidence);
  if (request.headers.get("accept")?.includes("text/event-stream"))
    return streamResponse(result, request, request.headers.get("last-event-id"));
  return publicApiResponse(result, request, result.abstained ? 200 : 201);
}
