import { describe, expect, it } from "vitest";
import {
  defaultBlockConfig,
  normalizeBlockConfig,
  parseLinksInput,
} from "@/lib/portal";

describe("portal helpers", () => {
  it("normalizes supported block config fields", () => {
    expect(
      normalizeBlockConfig({
        heading: "Featured courses",
        body: "Learn at your own pace.",
        courseLimit: 20,
        items: ["One", 2, "Three"],
      }),
    ).toEqual({
      heading: "Featured courses",
      body: "Learn at your own pace.",
      courseLimit: 12,
      items: ["One", "Three"],
    });
  });

  it("parses portal links from editable textarea format", () => {
    expect(
      parseLinksInput("Home|.\nCourses|./courses\nBroken", [
        { label: "Fallback", href: "/" },
      ]),
    ).toEqual([
      { label: "Home", href: "." },
      { label: "Courses", href: "./courses" },
    ]);
  });

  it("provides LMS-specific default hero copy", () => {
    expect(defaultBlockConfig("HERO")).toMatchObject({
      heading: "Build practical skills with our courses",
      ctaHref: "./courses",
    });
  });
});
