import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assetStorageKey,
  normalizeAssetOption,
  parseAssetTags,
  validateImageAsset,
} from "@/lib/assets";

describe("organization assets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates image uploads for the portal media library", () => {
    expect(() =>
      validateImageAsset({
        fileName: "course-preview.webp",
        mimeType: "image/webp",
        sizeBytes: 4_000_000,
      }),
    ).not.toThrow();

    expect(() =>
      validateImageAsset({
        fileName: "notes.pdf",
        mimeType: "application/pdf",
        sizeBytes: 200_000,
      }),
    ).toThrow("Upload a JPG, PNG, or WebP image.");

    expect(() =>
      validateImageAsset({
        fileName: "huge.png",
        mimeType: "image/png",
        sizeBytes: 6_000_000,
      }),
    ).toThrow("Images must be 5 MB or smaller.");
  });

  it("builds stable organization-scoped storage keys", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);

    expect(
      assetStorageKey({
        organizationId: "org_1",
        fileName: "Course Preview Image.PNG",
      }),
    ).toBe("portal-assets/org_1/1234-course-preview-image.png");
  });

  it("normalizes tags and asset options for builder controls", () => {
    expect(parseAssetTags("course, hero, course, ")).toEqual([
      "course",
      "hero",
      "course",
    ]);
    expect(
      normalizeAssetOption({
        id: "asset_1",
        url: "/uploads/image.png",
        filename: "image.png",
        altText: null,
        caption: "Preview",
      }),
    ).toEqual({
      id: "asset_1",
      url: "/uploads/image.png",
      filename: "image.png",
      altText: "",
      caption: "Preview",
      width: null,
      height: null,
    });
  });
});
