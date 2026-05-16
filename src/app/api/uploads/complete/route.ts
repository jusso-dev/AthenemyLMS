import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth";
import { canManageOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import {
  assetStorageKey,
  parseAssetTags,
  validateImageAsset,
} from "@/lib/assets";

const completeSchema = z.object({
  key: z.string().min(1).optional(),
  publicUrl: z.string().url().optional(),
  fileName: z.string().min(1),
  contentType: z.string().min(3).max(120).optional(),
  fileSize: z.number().int().positive().optional(),
  organizationId: z.string().min(1).optional(),
  kind: z.enum(["IMAGE"]).default("IMAGE"),
  dataUrl: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  altText: z.string().max(180).optional().or(z.literal("")),
  caption: z.string().max(240).optional().or(z.literal("")),
  tags: z.string().max(400).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const parsed = completeSchema.parse(await request.json());
  if (parsed.organizationId) {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: parsed.organizationId,
          userId: user.id,
        },
      },
    });
    if (!canManageOrganization(user, membership)) {
      return NextResponse.json(
        { error: "Organisation admin access is required." },
        { status: 403 },
      );
    }

    const mimeType = parsed.contentType ?? mimeTypeFromDataUrl(parsed.dataUrl);
    validateImageAsset({
      fileName: parsed.fileName,
      mimeType,
      sizeBytes: parsed.fileSize,
    });

    const localUpload = parsed.dataUrl
      ? await persistLocalAsset({
          organizationId: parsed.organizationId,
          fileName: parsed.fileName,
          dataUrl: parsed.dataUrl,
        })
      : null;
    const storageKey =
      parsed.key ??
      localUpload?.storageKey ??
      assetStorageKey({
        organizationId: parsed.organizationId,
        fileName: parsed.fileName,
      });
    const url = parsed.publicUrl ?? localUpload?.url;
    if (!url) {
      return NextResponse.json(
        { error: "Upload URL is required." },
        { status: 400 },
      );
    }

    const asset = await prisma.organizationAsset.create({
      data: {
        organizationId: parsed.organizationId,
        uploadedById: user.id,
        kind: "IMAGE",
        storageKey,
        url,
        filename: parsed.fileName,
        mimeType,
        sizeBytes: parsed.fileSize,
        width: parsed.width,
        height: parsed.height,
        altText: parsed.altText || null,
        caption: parsed.caption || null,
        tags: parseAssetTags(parsed.tags),
      },
    });

    return NextResponse.json({
      ok: true,
      asset,
      file: {
        key: asset.storageKey,
        publicUrl: asset.url,
        fileName: asset.filename,
        fileSize: asset.sizeBytes,
      },
      message: "Image added to the media library.",
    });
  }

  if (!parsed.key || !parsed.publicUrl) {
    return NextResponse.json(
      { error: "key and publicUrl are required" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    file: {
      key: parsed.key,
      publicUrl: parsed.publicUrl,
      fileName: parsed.fileName,
      fileSize: parsed.fileSize,
    },
    message:
      "Upload completed. Persist this file against a course thumbnail or lesson resource in the next form step.",
  });
}

function mimeTypeFromDataUrl(dataUrl: string | undefined) {
  const match = dataUrl?.match(/^data:([^;]+);base64,/);
  return match?.[1] ?? "";
}

async function persistLocalAsset(input: {
  organizationId: string;
  fileName: string;
  dataUrl: string;
}) {
  const match = input.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Upload payload is invalid.");

  const storageKey = assetStorageKey({
    organizationId: input.organizationId,
    fileName: input.fileName,
  });
  const buffer = Buffer.from(match[2], "base64");
  const destination = path.join(process.cwd(), "public", storageKey);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, buffer);

  return {
    storageKey,
    url: `/${storageKey}`,
  };
}
