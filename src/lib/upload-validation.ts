import sharp from "sharp";
import { maxImageUploadBytes, validateImageAsset } from "@/lib/assets";

export class UploadValidationError extends Error {}

export const maxImageRequestBytes =
  Math.ceil(maxImageUploadBytes / 3) * 4 + 16_384;

export async function readUploadJson(
  request: Request,
  limit = maxImageRequestBytes,
) {
  const reader = request.body?.getReader();
  if (!reader) throw new UploadValidationError("Upload payload is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new UploadValidationError("Upload payload is too large.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof UploadValidationError) throw error;
    throw new UploadValidationError("Upload payload must be valid JSON.");
  } finally {
    reader.releaseLock();
  }
}

export async function decodeImageUpload(
  dataUrl: string,
  declaredType?: string,
) {
  const match = dataUrl.match(
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match || match[2].length % 4 !== 0) {
    throw new UploadValidationError("Upload a valid JPG, PNG, or WebP image.");
  }
  if (declaredType && declaredType !== match[1]) {
    throw new UploadValidationError(
      "Image content type does not match the upload.",
    );
  }
  const bytes = Buffer.from(match[2], "base64");
  if (
    bytes.toString("base64") !== match[2] ||
    bytes.length > maxImageUploadBytes
  ) {
    throw new UploadValidationError(
      "Images must be valid base64 and 5 MB or smaller.",
    );
  }
  try {
    const image = sharp(bytes, {
      limitInputPixels: 25_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    const mimeType = mimeTypes[metadata.format ?? ""];
    if (mimeType !== match[1] || (metadata.pages ?? 1) > 1) {
      throw new UploadValidationError(
        "Upload a single JPG, PNG, or WebP image matching its content type.",
      );
    }
    // Decode and re-encode to discard untrusted trailing data and metadata.
    const { data, info } = await image
      .rotate()
      .toBuffer({ resolveWithObject: true });
    validateImageAsset({ fileName: "image", mimeType, sizeBytes: data.length });
    return { bytes: data, mimeType, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof UploadValidationError) throw error;
    throw new UploadValidationError(
      "Upload a valid image of at most 5 MB and 25 megapixels.",
    );
  }
}
