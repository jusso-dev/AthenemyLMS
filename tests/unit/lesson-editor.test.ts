import { describe, expect, it } from "vitest";
import { lessonContentSchema } from "@/lib/course-schemas";
import { parseLessonMarkdown } from "@/lib/lesson-markdown";

describe("lesson editor", () => {
  it("validates rich lesson content payloads", () => {
    const result = lessonContentSchema.safeParse({
      title: "Write useful outcomes",
      slug: "write-useful-outcomes",
      content: "## Outcomes\n\n- Draft one measurable outcome",
      videoUrl: "",
      durationMinutes: "12",
      preview: "true",
    });

    expect(result.success).toBe(true);
  });

  it("rejects oversized lesson bodies", () => {
    const result = lessonContentSchema.safeParse({
      title: "Write useful outcomes",
      slug: "write-useful-outcomes",
      content: "x".repeat(20001),
      videoUrl: "",
      durationMinutes: 12,
      preview: false,
    });

    expect(result.success).toBe(false);
  });

  it("parses supported Markdown blocks for previews", () => {
    expect(
      parseLessonMarkdown("## Heading\n\n> Note\n\n- One\n- Two\n\nParagraph"),
    ).toEqual([
      { type: "heading", level: 2, text: "Heading" },
      { type: "quote", text: "Note" },
      { type: "list", items: ["One", "Two"] },
      { type: "paragraph", text: "Paragraph" },
    ]);
  });
});
