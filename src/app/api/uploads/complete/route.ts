import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth";
import { canManageOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { assetStorageKey, parseAssetTags } from "@/lib/assets";
import {
  decodeImageUpload,
  readUploadJson,
  UploadValidationError,
} from "@/lib/upload-validation";
import { env, missingEnv, IntegrationSetupError } from "@/lib/env";
import { getR2Client } from "@/lib/r2";

const completeSchema = z.object({
  key: z.string().min(1).max(600).optional(),
  publicUrl: z.string().url().max(2000).optional(),
  fileName: z.string().trim().min(1).max(240),
  contentType: z.string().min(3).max(120).optional(),
  fileSize: z.number().int().positive().optional(),
  organizationId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  kind: z.enum(["IMAGE"]).default("IMAGE"),
  dataUrl: z.string().optional(),
  altText: z.string().max(180).optional(),
  caption: z.string().max(240).optional(),
  tags: z.string().max(400).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user)
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const parsed = completeSchema.parse(await readUploadJson(request));
    if (!parsed.organizationId) {
      const allowedPrefix = /^(thumbnails|resources|videos)\//.test(
        parsed.key ?? "",
      );
      const ownedKey = parsed.key?.split("/")[1] === user.id;
      const expectedUrl =
        env.CLOUDFLARE_R2_PUBLIC_BASE_URL && parsed.key
          ? `${env.CLOUDFLARE_R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${parsed.key}`
          : null;
      if (
        !allowedPrefix ||
        !ownedKey ||
        !expectedUrl ||
        parsed.publicUrl !== expectedUrl
      ) {
        throw new UploadValidationError(
          "A valid upload belonging to your account is required.",
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
        message: "Upload completed. Save the course or resource to attach it.",
      });
    }
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
    if (!parsed.dataUrl)
      throw new UploadValidationError("Image file data is required.");
    const image = await decodeImageUpload(parsed.dataUrl, parsed.contentType);
    const storageKey = assetStorageKey({
      organizationId: parsed.organizationId,
      fileName: `${randomUUID()}-${parsed.fileName}`,
      mimeType: image.mimeType,
    });
    const r2Configured =
      missingEnv([
        "CLOUDFLARE_R2_ACCOUNT_ID",
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
        "CLOUDFLARE_R2_BUCKET_NAME",
        "CLOUDFLARE_R2_PUBLIC_BASE_URL",
      ]).length === 0;
    if (!r2Configured && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Durable image storage is not configured." },
        { status: 503 },
      );
    }
    let url: string;
    let removeUpload: () => Promise<unknown>;
    if (r2Configured) {
      const client = getR2Client();
      const object = {
        Bucket: env.CLOUDFLARE_R2_BUCKET_NAME!,
        Key: storageKey,
      };
      await client.send(
        new PutObjectCommand({
          ...object,
          Body: image.bytes,
          ContentType: image.mimeType,
          ContentLength: image.bytes.length,
        }),
      );
      url = `${env.CLOUDFLARE_R2_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${storageKey}`;
      removeUpload = () => client.send(new DeleteObjectCommand(object));
    } else {
      const destination = path.join(process.cwd(), "public", storageKey);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, image.bytes, { flag: "wx" });
      url = `/${storageKey}`;
      removeUpload = () => unlink(destination);
    }
    let asset;
    try {
      asset = await prisma.organizationAsset.create({
        data: {
          organizationId: parsed.organizationId,
          uploadedById: user.id,
          kind: "IMAGE",
          storageKey,
          url,
          filename: parsed.fileName,
          mimeType: image.mimeType,
          sizeBytes: image.bytes.length,
          width: image.width,
          height: image.height,
          altText: parsed.altText || null,
          caption: parsed.caption || null,
          tags: parseAssetTags(parsed.tags),
        },
      });
    } catch (error) {
      await removeUpload().catch(() => undefined);
      throw error;
    }
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
  } catch (error) {
    if (error instanceof IntegrationSetupError) {
      return NextResponse.json(
        { error: "Durable image storage is not configured." },
        { status: 503 },
      );
    }
    if (error instanceof z.ZodError || error instanceof UploadValidationError) {
      return NextResponse.json(
        {
          error:
            error instanceof UploadValidationError
              ? error.message
              : "Invalid upload fields.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Upload could not be saved. Please try again." },
      { status: 500 },
    );
  }
}
