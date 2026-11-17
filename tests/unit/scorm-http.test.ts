import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { scormAppOrigin } from "@/lib/scorm-http";

afterEach(() => vi.unstubAllEnvs());

describe("SCORM public request origin", () => {
  it("uses the configured public origin behind a proxy instead of Next's internal hostname", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://learning.example.test/");
    const request = new NextRequest("http://localhost:3000/api/scorm/launch", {
      headers: {
        host: "learning.example.test",
        origin: "https://learning.example.test",
      },
    });
    expect(scormAppOrigin(request)).toBe("https://learning.example.test");
  });
  it("uses the actual browser host in unconfigured local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const request = new NextRequest("http://localhost:3101/api/scorm/launch", {
      headers: { host: "127.0.0.1:3101" },
    });
    expect(scormAppOrigin(request)).toBe("http://127.0.0.1:3101");
  });
  it("requires a configured canonical origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(() =>
      scormAppOrigin(new NextRequest("http://localhost/api/scorm/launch")),
    ).toThrow("NEXT_PUBLIC_APP_URL");
  });
});
