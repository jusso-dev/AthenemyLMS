import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decodeImageUpload, readUploadJson } from "@/lib/upload-validation";
import { assetStorageKey, maxImageUploadBytes } from "@/lib/assets";

describe("image upload boundary", () => {
  it.each(["png", "jpeg", "webp"] as const)(
    "decodes and normalizes real %s image bytes",
    async (format) => {
      const bytes = await sharp({
        create: { width: 2, height: 3, channels: 3, background: "white" },
      })
        .toFormat(format)
        .toBuffer();
      const image = await decodeImageUpload(
        `data:image/${format};base64,${bytes.toString("base64")}`,
      );
      expect(image).toMatchObject({
        mimeType: `image/${format}`,
        width: 2,
        height: 3,
      });
      expect((await sharp(image.bytes).metadata()).format).toBe(format);
    },
  );
  it("rejects claimed image types without matching image content", async () => {
    await expect(
      decodeImageUpload(
        `data:image/png;base64,${Buffer.from("not an image").toString("base64")}`,
      ),
    ).rejects.toThrow("valid image");
  });
  it("rejects mismatched image declarations", async () => {
    const bytes = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(
      decodeImageUpload(
        `data:image/png;base64,${bytes.toString("base64")}`,
        "image/jpeg",
      ),
    ).rejects.toThrow("does not match");
    await expect(
      decodeImageUpload(`data:image/jpeg;base64,${bytes.toString("base64")}`),
    ).rejects.toThrow("matching its content type");
  });
  it("rejects malformed base64 and excessive decoded size", async () => {
    await expect(
      decodeImageUpload("data:image/png;base64,invalid"),
    ).rejects.toThrow();
    await expect(
      decodeImageUpload(
        `data:image/png;base64,${Buffer.alloc(maxImageUploadBytes + 1).toString("base64")}`,
      ),
    ).rejects.toThrow("5 MB");
  });
  it("bounds streamed JSON before decoding", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ data: "123456789" }),
    });
    await expect(readUploadJson(request, 10)).rejects.toThrow("too large");
  });
  it("derives the stored extension from validated MIME", () => {
    expect(
      assetStorageKey({
        organizationId: "org_1",
        fileName: "preview.bin",
        mimeType: "image/png",
      }),
    ).toMatch(/\.png$/);
    expect(() =>
      assetStorageKey({ organizationId: "org_1", fileName: "preview.bin" }),
    ).toThrow("JPG");
  });
});
