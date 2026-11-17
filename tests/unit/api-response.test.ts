import { describe, expect, it } from "vitest";
import {
  apiError,
  apiJson,
  parsePagination,
} from "@/lib/developer/api-response";

describe("API response contracts", () => {
  it("does not disclose unexpected internal errors", async () => {
    const response = apiError(new Error("Internal database diagnostic"));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatchObject({
      code: "internal_error",
      message: "The request could not be completed.",
    });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });
  it("retains safe client errors", async () => {
    const response = apiError(
      Object.assign(new Error("Course not found."), {
        status: 404,
        code: "not_found",
      }),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.message).toBe("Course not found.");
  });
  it("does not advertise unenforced rate limits", () => {
    expect(apiJson({}).headers.get("x-ratelimit-remaining")).toBeNull();
  });
  it.each(["0", "-1", "1.5", "NaN", "Infinity", "abc", "", "9007199254740992"])(
    "rejects invalid limit %s",
    (limit) => {
      expect(() =>
        parsePagination(new URL(`https://example.test?limit=${limit}`)),
      ).toThrow("positive integer");
    },
  );
  it("defaults and caps valid integer page sizes", () => {
    expect(parsePagination(new URL("https://example.test"))).toEqual({
      take: 25,
      cursor: undefined,
    });
    expect(
      parsePagination(new URL("https://example.test?limit=200&cursor=next")),
    ).toEqual({ take: 100, cursor: "next" });
  });
});
