import { describe, expect, it } from "vitest";
import { formatPrice, percentage, slugify } from "@/lib/utils";

describe("utils", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("Course Design: Foundations!")).toBe(
      "course-design-foundations",
    );
  });

  it("formats free and paid prices", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(7900)).toBe("$79.00");
  });

  it("guards percentage division by zero", () => {
    expect(percentage(3, 0)).toBe(0);
    expect(percentage(3, 4)).toBe(75);
  });
});
