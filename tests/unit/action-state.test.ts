import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { formatActionError } from "@/lib/action-state";

describe("action feedback", () => {
  it("keeps database diagnostics out of user-facing errors", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Internal persistence details",
      { code: "P2034", clientVersion: "6" },
    );
    expect(formatActionError(error)).toBe(
      "Your changes could not be saved. Please try again.",
    );
  });
  it("preserves intentional workflow feedback", () => {
    expect(formatActionError(new Error("Choose an organisation role."))).toBe(
      "Choose an organisation role.",
    );
  });
});
