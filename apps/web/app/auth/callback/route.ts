import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/sign-in?error=missing_code", url));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.redirect(new URL("/sign-in?error=missing_config", url));
  }
  const requestedNext = url.searchParams.get("next");
  const next = requestedNext?.startsWith("/") ? requestedNext : "/dashboard";
  const response = NextResponse.redirect(new URL(next, url));
  const client = createServerClient(supabaseUrl, anonKey, {
    db: { schema: "app" },
    cookies: {
      getAll: () => (request.headers.get("cookie") ? request.cookies.getAll() : []),
      setAll: (cookies) => {
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/sign-in?error=callback_failed", url));
  return response;
}
