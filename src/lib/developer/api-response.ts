import { NextResponse } from "next/server";

export function apiJson<T>(
  body: T,
  init?: ResponseInit & { requestId?: string },
) {
  const requestId = init?.requestId ?? createRequestId();
  const response = NextResponse.json(body, init);
  response.headers.set("x-request-id", requestId);
  return response;
}

export function apiError(
  error: unknown,
  fallback = "The request could not be completed.",
) {
  const requestId = createRequestId();
  const requestedStatus =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : 500;
  const status =
    Number.isInteger(requestedStatus) &&
    requestedStatus >= 400 &&
    requestedStatus <= 599
      ? requestedStatus
      : 500;
  const code =
    status < 500 &&
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : status === 500
        ? "internal_error"
        : "request_error";
  const message =
    status < 500 && error instanceof Error ? error.message : fallback;

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
  const rawLimit = url.searchParams.get("limit") ?? "25";
  const limit = Number(rawLimit);
  if (!/^\d+$/.test(rawLimit) || !Number.isSafeInteger(limit) || limit < 1) {
    throw Object.assign(new Error("limit must be a positive integer."), {
      status: 400,
      code: "invalid_request",
    });
  }
  const take = Math.min(100, limit);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  return { take, cursor };
}

export function pageInfo<T extends { id: string }>(items: T[], take: number) {
  return {
    hasMore: items.length > take,
    nextCursor: items.length > take ? items[take - 1]?.id : null,
  };
}
