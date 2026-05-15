import { describe, expect, it } from "vitest";
import { courseSchema } from "@/lib/course-schemas";

describe("courseSchema", () => {
  it("accepts a valid course draft", () => {
    const result = courseSchema.safeParse({
      title: "Course Design Foundations",
      slug: "course-design-foundations",
      subtitle: "A useful course",
      description: "Detailed overview",
      priceCents: 0,
      status: "DRAFT",
      thumbnailUrl: "",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsafe slugs", () => {
    const result = courseSchema.safeParse({
      title: "Bad slug",
      slug: "Bad Slug",
      priceCents: 0,
      status: "DRAFT",
    });

    expect(result.success).toBe(false);
  });
});
