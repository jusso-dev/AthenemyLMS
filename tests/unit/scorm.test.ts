import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parseScorm12Manifest } from "@/lib/scorm";

describe("SCORM manifest parsing", () => {
  it("parses a SCORM 1.2 package manifest", async () => {
    const zip = new JSZip();
    zip.file(
      "imsmanifest.xml",
      `<?xml version="1.0"?>
      <manifest identifier="pkg-1">
        <metadata>
          <schema>ADL SCORM</schema>
          <schemaversion>1.2</schemaversion>
        </metadata>
        <organizations default="org-1">
          <organization identifier="org-1">
            <title>Security Awareness</title>
            <item identifier="item-1" identifierref="resource-1">
              <title>Launch</title>
            </item>
          </organization>
        </organizations>
        <resources>
          <resource identifier="resource-1" type="webcontent" href="index.html" />
        </resources>
      </manifest>`,
    );

    const manifest = await parseScorm12Manifest(
      await zip.generateAsync({ type: "arraybuffer" }),
    );

    expect(manifest).toMatchObject({
      identifier: "pkg-1",
      title: "Security Awareness",
      version: "1.2",
      launchPath: "index.html",
    });
  });

  it("rejects packages without imsmanifest.xml", async () => {
    const zip = new JSZip();
    zip.file("index.html", "<h1>Launch</h1>");

    await expect(
      parseScorm12Manifest(await zip.generateAsync({ type: "arraybuffer" })),
    ).rejects.toThrow("SCORM package is missing imsmanifest.xml.");
  });
});
