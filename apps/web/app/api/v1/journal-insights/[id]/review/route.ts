import { apiResponse } from "@/lib/api/response";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await params;
  return apiResponse(
    {
      code: "JOURNAL_INSIGHTS_RETIRED",
      detail: "Journal entries are indexed as private knowledge-base material instead."
    },
    request,
    410
  );
}
