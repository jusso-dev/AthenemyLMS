"use client";

import { ImageIcon, Loader2, Plus, Trash2, Upload } from "lucide-react";
import type * as React from "react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PortalAssetOption = {
  id: string;
  url: string;
  filename: string;
  altText: string;
  caption: string;
  width: number | null;
  height: number | null;
};

type GalleryImage = {
  url: string;
  alt: string;
  caption?: string;
};

export function MediaLibraryField({
  organizationId,
  assets,
  imageUrlName,
  imageAltName,
  imageCaptionName,
  defaultUrl,
  defaultAlt,
  defaultCaption,
}: {
  organizationId: string;
  assets: PortalAssetOption[];
  imageUrlName: string;
  imageAltName: string;
  imageCaptionName: string;
  defaultUrl?: string;
  defaultAlt?: string;
  defaultCaption?: string;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [alt, setAlt] = useState(defaultAlt ?? "");
  const [caption, setCaption] = useState(defaultCaption ?? "");
  const upload = useAssetUpload(organizationId);

  return (
    <div className="grid gap-4">
      <input type="hidden" name={imageUrlName} value={url} />
      <input type="hidden" name={imageAltName} value={alt} />
      <input type="hidden" name={imageCaptionName} value={caption} />
      <SelectedImagePreview url={url} alt={alt} caption={caption} />
      <AssetPicker
        assets={assets}
        selectedUrl={url}
        onSelect={(asset) => {
          setUrl(asset.url);
          setAlt(asset.altText || asset.filename);
          setCaption(asset.caption);
        }}
      />
      <UploadImageControl
        upload={upload}
        onUploaded={(asset) => {
          setUrl(asset.url);
          setAlt(asset.altText || asset.filename);
          setCaption(asset.caption);
        }}
      />
      <div className="grid gap-3">
        <LabeledControl label="Paste URL fallback">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://..."
          />
        </LabeledControl>
        <div className="grid gap-3 md:grid-cols-2">
          <LabeledControl label="Alt text">
            <Input
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              placeholder="Describe the image"
            />
          </LabeledControl>
          <LabeledControl label="Caption">
            <Input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Optional caption"
            />
          </LabeledControl>
        </div>
      </div>
    </div>
  );
}

export function GalleryLibraryField({
  organizationId,
  assets,
  name,
  defaultImages,
}: {
  organizationId: string;
  assets: PortalAssetOption[];
  name: string;
  defaultImages: GalleryImage[];
}) {
  const [images, setImages] = useState<GalleryImage[]>(defaultImages);
  const upload = useAssetUpload(organizationId);
  const serialized = useMemo(() => imagesToInput(images), [images]);

  function updateImage(index: number, next: Partial<GalleryImage>) {
    setImages((current) =>
      current.map((image, imageIndex) =>
        imageIndex === index ? { ...image, ...next } : image,
      ),
    );
  }

  function addAsset(asset: PortalAssetOption) {
    setImages((current) => [
      ...current,
      {
        url: asset.url,
        alt: asset.altText || asset.filename,
        caption: asset.caption || undefined,
      },
    ]);
  }

  return (
    <div className="grid gap-4">
      <textarea name={name} value={serialized} readOnly hidden />
      <AssetPicker assets={assets} onSelect={addAsset} />
      <UploadImageControl upload={upload} onUploaded={addAsset} />
      <div className="space-y-3">
        {images.map((image, index) => (
          <div
            key={`${image.url}-${index}`}
            className="grid gap-3 rounded-md border bg-background p-3"
          >
            <div className="flex items-start gap-3">
              <ImageThumb url={image.url} alt={image.alt} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Image {index + 1}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {image.url || "Add an image URL or choose from the library"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === 0}
                  onClick={() =>
                    setImages((current) => moveItem(current, index, index - 1))
                  }
                >
                  Up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === images.length - 1}
                  onClick={() =>
                    setImages((current) => moveItem(current, index, index + 1))
                  }
                >
                  Down
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove image ${index + 1}`}
                  onClick={() =>
                    setImages((current) =>
                      current.filter((_, imageIndex) => imageIndex !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <LabeledControl label="Image URL">
              <Input
                value={image.url}
                onChange={(event) =>
                  updateImage(index, { url: event.target.value })
                }
                placeholder="https://..."
              />
            </LabeledControl>
            <div className="grid gap-3 md:grid-cols-2">
              <LabeledControl label="Alt text">
                <Input
                  value={image.alt}
                  onChange={(event) =>
                    updateImage(index, { alt: event.target.value })
                  }
                  placeholder="Describe the image"
                />
              </LabeledControl>
              <LabeledControl label="Caption">
                <Input
                  value={image.caption ?? ""}
                  onChange={(event) =>
                    updateImage(index, { caption: event.target.value })
                  }
                  placeholder="Optional caption"
                />
              </LabeledControl>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() =>
          setImages((current) => [
            ...current,
            { url: "", alt: "", caption: "" },
          ])
        }
      >
        <Plus className="h-4 w-4" />
        Add URL row
      </Button>
    </div>
  );
}

function AssetPicker({
  assets,
  selectedUrl,
  onSelect,
}: {
  assets: PortalAssetOption[];
  selectedUrl?: string;
  onSelect: (asset: PortalAssetOption) => void;
}) {
  if (assets.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
        Uploaded images for this organisation will appear here.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Choose from library</p>
      <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {assets.map((asset) => {
          const selected = selectedUrl === asset.url;
          return (
            <button
              key={asset.id}
              type="button"
              className={cn(
                "overflow-hidden rounded-md border bg-background text-left transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected && "border-primary ring-1 ring-primary",
              )}
              onClick={() => onSelect(asset)}
            >
              <ImageThumb url={asset.url} alt={asset.altText} large />
              <span className="block truncate px-2 py-1.5 text-xs font-medium">
                {asset.caption || asset.filename}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UploadImageControl({
  upload,
  onUploaded,
}: {
  upload: ReturnType<typeof useAssetUpload>;
  onUploaded: (asset: PortalAssetOption) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");

  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <LabeledControl label="Upload image">
          <Input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
          />
        </LabeledControl>
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={upload.pending}
          onClick={async () => {
            const file = fileRef.current?.files?.[0];
            if (!file) {
              upload.setMessage("Choose a JPG, PNG, or WebP image first.");
              return;
            }
            const asset = await upload.upload(file, altText, caption);
            if (asset) {
              onUploaded(asset);
              setAltText("");
              setCaption("");
              if (fileRef.current) fileRef.current.value = "";
            }
          }}
        >
          {upload.pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {upload.pending ? "Uploading..." : "Upload"}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <LabeledControl label="Alt text">
          <Input
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            placeholder="Strongly recommended"
          />
        </LabeledControl>
        <LabeledControl label="Caption">
          <Input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Optional"
          />
        </LabeledControl>
      </div>
      {upload.message ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            upload.error
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
          )}
          role={upload.error ? "alert" : "status"}
        >
          {upload.message}
        </p>
      ) : null}
    </div>
  );
}

function SelectedImagePreview({
  url,
  alt,
  caption,
}: {
  url: string;
  alt: string;
  caption: string;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <ImageThumb url={url} alt={alt} large />
      <p className="mt-2 text-sm font-medium">
        {caption || alt || "Selected image"}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {url || "Choose, upload, or paste an image URL."}
      </p>
    </div>
  );
}

function ImageThumb({
  url,
  alt,
  large = false,
}: {
  url: string;
  alt: string;
  large?: boolean;
}) {
  if (!url) {
    return (
      <span
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          large ? "aspect-video w-full" : "h-14 w-20 rounded-md",
        )}
      >
        <ImageIcon className="h-5 w-5" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt || ""}
      className={cn(
        "bg-muted object-cover",
        large ? "aspect-video w-full" : "h-14 w-20 rounded-md",
      )}
    />
  );
}

function LabeledControl({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid flex-1 gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

function useAssetUpload(organizationId: string) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function upload(file: File, altText: string, caption: string) {
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const dataUrl = await fileToDataUrl(file);
      const dimensions = await imageDimensions(dataUrl);
      const response = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          kind: "IMAGE",
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          dataUrl,
          width: dimensions.width || undefined,
          height: dimensions.height || undefined,
          altText,
          caption,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed.");
      }
      setMessage(payload.message ?? "Image uploaded.");
      return {
        id: payload.asset.id,
        url: payload.asset.url,
        filename: payload.asset.filename,
        altText: payload.asset.altText ?? "",
        caption: payload.asset.caption ?? "",
        width: payload.asset.width ?? null,
        height: payload.asset.height ?? null,
      } satisfies PortalAssetOption;
    } catch (uploadError) {
      setError(true);
      setMessage(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
      return null;
    } finally {
      setPending(false);
    }
  }

  return { pending, message, error, upload, setMessage };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}

function imageDimensions(src: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = src;
  });
}

function imagesToInput(images: GalleryImage[]) {
  return images
    .map((image) =>
      [image.url, image.alt, image.caption]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join("|"),
    )
    .join("\n");
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
