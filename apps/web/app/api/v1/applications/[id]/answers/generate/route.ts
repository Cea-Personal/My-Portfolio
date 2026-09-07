import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { generateApplicationAnswers } from "@/lib/server/application-answer-generation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    try {
      const result = await generateApplicationAnswers(client, ownerId, id);
      return apiResponse(result, request);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message.slice(0, 240) : "ANSWER_GENERATION_FAILED";
      return apiResponse(
        { code: detail, detail: "Application answers could not be generated." },
        request,
        422
      );
    }
  });
}
