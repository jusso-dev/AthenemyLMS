import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { IntegrationSetupError } from "@/lib/env";
import { createPresignedUpload } from "@/lib/r2";
import { slugify } from "@/lib/utils";
import { getCurrentAppUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readUploadJson, UploadValidationError } from "@/lib/upload-validation";

const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
  "text/plain": "txt",
};
const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  contentType: z.string().min(3).max(120),
  fileSize: z.number().int().positive(),
  folder: z
    .enum(["thumbnails", "resources", "videos", "portal-assets"])
    .default("resources"),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user)
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    if (user.role === "STUDENT") {
      const membership = await prisma.organizationMembership.findFirst({
        where: {
          userId: user.id,
          role: { in: ["OWNER", "ADMIN", "INSTRUCTOR"] },
        },
        select: { id: true },
      });
      if (!membership)
        return NextResponse.json(
          { error: "Course author access is required." },
          { status: 403 },
        );
    }
    const parsed = uploadSchema.parse(await readUploadJson(request, 8192));
    const extension = mimeExtensions[parsed.contentType];
    const allowedType =
      parsed.folder === "videos"
        ? parsed.contentType.startsWith("video/")
        : parsed.folder === "resources"
          ? true
          : parsed.contentType.startsWith("image/");
    const limit =
      parsed.folder === "videos"
        ? 500 * 1024 * 1024
        : parsed.folder === "resources"
          ? 25 * 1024 * 1024
          : 5 * 1024 * 1024;
    if (!extension || !allowedType || parsed.fileSize > limit) {
      throw new UploadValidationError("Unsupported file type or upload size.");
    }
    const baseName = parsed.fileName.replace(/\.[^.]+$/, "");
    const key = `${parsed.folder}/${user.id}/${randomUUID()}-${slugify(baseName) || "upload"}.${extension}`;
    return NextResponse.json(
      await createPresignedUpload({
        key,
        contentType: parsed.contentType,
        sizeBytes: parsed.fileSize,
      }),
    );
  } catch (error) {
    if (error instanceof IntegrationSetupError)
      return NextResponse.json({ error: error.message }, { status: 503 });
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
      { error: "Upload could not be prepared. Please try again." },
      { status: 500 },
    );
  }
}
