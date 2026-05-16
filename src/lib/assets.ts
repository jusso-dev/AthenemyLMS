import { slugify } from "@/lib/utils";

export const allowedImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const maxImageUploadBytes = 5 * 1024 * 1024;

export type AssetValidationInput = {
  fileName: string;
  mimeType: string;
  sizeBytes?: number | null;
};

export function validateImageAsset(input: AssetValidationInput) {
  if (!allowedImageMimeTypes.some((mimeType) => mimeType === input.mimeType)) {
    throw new Error("Upload a JPG, PNG, or WebP image.");
  }

  if (input.sizeBytes && input.sizeBytes > maxImageUploadBytes) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  if (!input.fileName.trim()) {
    throw new Error("Image filename is required.");
  }
}

export function assetStorageKey(input: {
  organizationId: string;
  fileName: string;
}) {
  const extension = input.fileName.split(".").pop()?.toLowerCase();
  const baseName = input.fileName.replace(/\.[^.]+$/, "");
  const safeName = slugify(baseName) || "asset";
  const suffix = extension ? `.${extension}` : "";
  return `portal-assets/${input.organizationId}/${Date.now()}-${safeName}${suffix}`;
}

export function parseAssetTags(input: string | null | undefined) {
  return String(input ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function normalizeAssetOption(input: {
  id: string;
  url: string;
  filename: string;
  altText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
}) {
  return {
    id: input.id,
    url: input.url,
    filename: input.filename,
    altText: input.altText ?? "",
    caption: input.caption ?? "",
    width: input.width ?? null,
    height: input.height ?? null,
  };
}
