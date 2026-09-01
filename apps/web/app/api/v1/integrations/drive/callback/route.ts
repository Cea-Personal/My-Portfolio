import { apiResponse } from "@/lib/api/response";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return apiResponse({ connected: url.searchParams.get("code") !== null }, request);
}
