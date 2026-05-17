import { NextResponse } from "next/server";

export function apiJson<T>(
  body: T,
  init?: ResponseInit & { requestId?: string },
) {
  const requestId = init?.requestId ?? createRequestId();
  const response = NextResponse.json(body, init);
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-ratelimit-limit", "600");
  response.headers.set("x-ratelimit-remaining", "599");
  return response;
}

export function apiError(
  error: unknown,
  fallback = "The request could not be completed.",
) {
  const requestId = createRequestId();
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : 500;
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : status === 500
        ? "internal_error"
        : "request_error";
  const message = error instanceof Error ? error.message : fallback;

  return apiJson(
    {
      error: {
        code,
        message,
        requestId,
      },
    },
    { status, requestId },
  );
}

export function createRequestId() {
  return `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

export function parsePagination(url: URL) {
  const take = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 25)),
  );
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { take, cursor };
}

export function pageInfo<T extends { id: string }>(items: T[], take: number) {
  return {
    hasMore: items.length > take,
    nextCursor: items.length > take ? items[take - 1]?.id : null,
  };
}
