import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const privateApi = path.startsWith("/api/v1/") && !path.startsWith("/api/v1/public/");
  const privatePage = [
    "/dashboard",
    "/analytics",
    "/blog",
    "/career-brain",
    "/documents",
    "/jobs",
    "/settings"
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  const providerCallback =
    path.includes("/integrations/drive/callback") || path.includes("/integrations/drive/webhook");
  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
  if (privatePage && !hasAuthCookie) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";
    signInUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }
  if (privateApi && !providerCallback && !hasAuthCookie && !request.headers.get("authorization")) {
    const response = NextResponse.json(
      { error: "UNAUTHORIZED", detail: "Authentication required." },
      { status: 401 }
    );
    response.headers.set("cache-control", "private, no-store");
    response.headers.set(
      "x-correlation-id",
      request.headers.get("x-correlation-id") ?? crypto.randomUUID()
    );
    return response;
  }
  const response = NextResponse.next();
  response.headers.set(
    "x-correlation-id",
    request.headers.get("x-correlation-id") ?? crypto.randomUUID()
  );
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("x-frame-options", "DENY");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
