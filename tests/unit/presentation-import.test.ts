import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  buildPresentationCourseDraft,
  googleSlidesExportUrl,
} from "@/lib/presentation-import";

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

  it("imports slides in presentation order with paragraph text and image dimensions", async () => {
    const zip = new JSZip();
    zip.file(
      "ppt/presentation.xml",
      `<p:presentation xmlns:p="p" xmlns:r="r">
        <p:sldIdLst>
          <p:sldId r:id="rId2" />
          <p:sldId r:id="rId1" />
        </p:sldIdLst>
      </p:presentation>`,
    );
    zip.file(
      "ppt/_rels/presentation.xml.rels",
      `<Relationships>
        <Relationship Id="rId1" Type="slide" Target="slides/slide2.xml" />
        <Relationship Id="rId2" Type="slide" Target="slides/slide1.xml" />
      </Relationships>`,
    );
    zip.file(
      "ppt/slides/slide1.xml",
      slideXml({
        title: "First imported slide",
        body: ["The ", "fragmented ", "paragraph"],
        footer: "Deck title",
      }),
    );
    zip.file(
      "ppt/slides/_rels/slide1.xml.rels",
      `<Relationships>
        <Relationship Id="rImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png" />
      </Relationships>`,
    );
    zip.file(
      "ppt/slides/slide2.xml",
      slideXml({ title: "Second imported slide", body: ["Another paragraph"] }),
    );
    zip.file("ppt/slides/_rels/slide2.xml.rels", "<Relationships />");
    zip.file("ppt/media/image1.png", new Uint8Array([1, 2, 3, 4]));

    const draft = await buildPresentationCourseDraft({
      data: await zip.generateAsync({ type: "arraybuffer" }),
      fileName: "Deck title.pptx",
    });

    expect(draft.lessons.map((lesson) => lesson.title)).toEqual([
      "First imported slide",
      "Second imported slide",
    ]);
    expect(draft.lessons[0].content).toContain("The fragmented paragraph");
    expect(draft.lessons[0].content).not.toContain("Deck title");
    expect(draft.lessons[0].content).not.toContain("1 / 2");
    expect(draft.lessons[0].content).toContain("{width=96 height=48}");
  });
});

function slideXml({
  title,
  body,
  footer,
}: {
  title: string;
  body: string[];
  footer?: string;
}) {
  return `<p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r">
    <p:cSld>
      <p:spTree>
        <p:sp>
          <p:txBody>
            <a:p><a:r><a:t>${title}</a:t></a:r></a:p>
            <a:p>${body.map((text) => `<a:r><a:t>${text}</a:t></a:r>`).join("")}</a:p>
            ${footer ? `<a:p><a:r><a:t>${footer}</a:t></a:r></a:p>` : ""}
            ${footer ? "<a:p><a:r><a:t>1 / 2</a:t></a:r></a:p>" : ""}
          </p:txBody>
        </p:sp>
        <p:pic>
          <p:blipFill><a:blip r:embed="rImg1" /></p:blipFill>
          <p:spPr><a:xfrm><a:ext cx="914400" cy="457200" /></a:xfrm></p:spPr>
        </p:pic>
      </p:spTree>
    </p:cSld>
  </p:sld>`;
}
