import { NextRequest, NextResponse } from "next/server";

// Redirect to manifest
export async function GET(request: NextRequest) {
  const manifestUrl = `${request.nextUrl.origin}/api/stremio/manifest`;
  return NextResponse.redirect(manifestUrl);
}
