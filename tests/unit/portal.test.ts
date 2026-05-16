import { describe, expect, it } from "vitest";
import {
  defaultBlockConfig,
  draftTheme,
  imagesToTextarea,
  normalizeBlockConfig,
  parseLinksInput,
  portalTemplateById,
} from "@/lib/portal";

describe("portal helpers", () => {
  it("normalizes supported block config fields", () => {
    expect(
      normalizeBlockConfig({
        heading: "Featured courses",
        body: "Learn at your own pace.",
        courseLimit: 20,
        items: ["One", 2, "Three"],
        imageUrl: "https://example.com/image.jpg",
        imageAlt: "Learning image",
        imageCaption: "A caption",
        imageLayout: "banner",
        images: [
          {
            url: "https://example.com/one.jpg",
            alt: "One",
            caption: "First",
          },
          { url: 3, alt: "Broken" },
        ],
      }),
    ).toEqual({
      heading: "Featured courses",
      body: "Learn at your own pace.",
      courseLimit: 12,
      items: ["One", "Three"],
      imageUrl: "https://example.com/image.jpg",
      imageAlt: "Learning image",
      imageCaption: "A caption",
      imageLayout: "banner",
      images: [
        {
          url: "https://example.com/one.jpg",
          alt: "One",
          caption: "First",
        },
        {
          url: "",
          alt: "Broken",
        },
      ],
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

  it("provides media defaults and homepage templates", () => {
    expect(defaultBlockConfig("GALLERY")).toMatchObject({
      heading: "Learning in action",
    });
    expect(portalTemplateById("course-academy")?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "IMAGE_TEXT" }),
        expect.objectContaining({ type: "GALLERY" }),
      ]),
    );
  });

  it("serializes gallery images for the builder textarea", () => {
    expect(
      imagesToTextarea([
        {
          url: "https://example.com/image.jpg",
          alt: "Example",
          caption: "Caption",
        },
      ]),
    ).toBe("https://example.com/image.jpg|Example|Caption");
  });

  it("normalizes portal theme mode", () => {
    expect(
      draftTheme({
        primaryColor: "#123456",
        accentColor: "#abcdef",
        fontFamily: "sans",
        buttonStyle: "rounded",
        themeMode: "dark",
      }).themeMode,
    ).toBe("dark");

    expect(
      draftTheme({
        primaryColor: "#123456",
        accentColor: "#abcdef",
        fontFamily: "sans",
        buttonStyle: "rounded",
        themeMode: "unexpected",
      }).themeMode,
    ).toBe("system");
  });
});
