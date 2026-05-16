import { describe, expect, it } from "vitest";
import { googleSlidesExportUrl } from "@/lib/presentation-import";

describe("presentation import", () => {
  it("converts Google Slides URLs to PowerPoint export URLs", () => {
    expect(
      googleSlidesExportUrl(
        "https://docs.google.com/presentation/d/deck_123/edit#slide=id.p",
      ),
    ).toBe("https://docs.google.com/presentation/d/deck_123/export/pptx");
  });

  it("rejects non-Google presentation URLs", () => {
    expect(googleSlidesExportUrl("https://example.com/deck")).toBeNull();
  });
});
