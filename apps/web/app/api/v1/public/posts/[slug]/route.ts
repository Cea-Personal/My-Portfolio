import { loadPublicBlogPost } from "@/lib/api/public-data";
import { publicApiResponse } from "@/lib/api/response";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await loadPublicBlogPost(slug);
  if (!post) return publicApiResponse(null, request, 404);
  return publicApiResponse(post, request);
}
