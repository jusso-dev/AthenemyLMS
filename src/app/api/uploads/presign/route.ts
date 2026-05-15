import { NextResponse } from "next/server";
import { z } from "zod";
import { IntegrationSetupError } from "@/lib/env";
import { createPresignedUpload } from "@/lib/r2";
import { slugify } from "@/lib/utils";
import { getCurrentAppUser } from "@/lib/auth";

const uploadSchema = z.object({
  fileName: z.string().min(1).max(240),
  contentType: z.string().min(3).max(120),
  folder: z.enum(["thumbnails", "resources", "videos"]).default("resources"),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const parsed = uploadSchema.parse(await request.json());
    const extension = parsed.fileName.split(".").pop();
    const baseName = parsed.fileName.replace(/\.[^.]+$/, "");
    const key = `${parsed.folder}/${user.id}/${Date.now()}-${slugify(baseName)}${
      extension ? `.${extension}` : ""
    }`;

    const result = await createPresignedUpload({
      key,
      contentType: parsed.contentType,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof IntegrationSetupError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload presign failed" },
      { status: 400 },
    );
  }
}
