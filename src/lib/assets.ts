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

  if (
    input.sizeBytes != null &&
    (!Number.isSafeInteger(input.sizeBytes) ||
      input.sizeBytes <= 0 ||
      input.sizeBytes > maxImageUploadBytes)
  ) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  if (!input.fileName.trim()) {
    throw new Error("Image filename is required.");
  }
}

export function assetStorageKey(input: {
  organizationId: string;
  fileName: string;
  mimeType?: string;
}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(input.organizationId)) {
    throw new Error("Invalid organisation identifier.");
  }
  const extension = input.fileName.split(".").pop()?.toLowerCase();
  const baseName = input.fileName.replace(/\.[^.]+$/, "");
  const safeName = slugify(baseName).slice(0, 160) || "asset";
  const canonicalExtension = input.mimeType
    ? { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[
        input.mimeType
      ]
    : extension;
  if (
    !canonicalExtension ||
    !["png", "jpg", "jpeg", "webp"].includes(canonicalExtension)
  ) {
    throw new Error("Upload a JPG, PNG, or WebP image.");
  }
  const suffix = `.${canonicalExtension}`;
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
