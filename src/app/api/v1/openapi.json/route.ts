import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/developer/openapi";
import { env } from "@/lib/env";

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const baseUrl = env.NEXT_PUBLIC_APP_URL || requestUrl.origin;
  const spec = buildOpenApiSpec({ baseUrl });
  return NextResponse.json(spec, {
    headers: {
      "cache-control": "public, max-age=60",
    },
  });
}
