import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/settings/documents?drive=user-oauth-disabled", url));
}
