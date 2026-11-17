import type { NextRequest } from "next/server";

/** Next's internal request URL can use a different host behind a proxy. */
export function scormAppOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV === "production")
    throw new Error("NEXT_PUBLIC_APP_URL is required for the SCORM player.");
  const host = request.headers.get("host");
  return host
    ? new URL(`${request.nextUrl.protocol}//${host}`).origin
    : request.nextUrl.origin;
}
