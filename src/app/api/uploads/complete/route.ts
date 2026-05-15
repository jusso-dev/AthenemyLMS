import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth";

const completeSchema = z.object({
  key: z.string().min(1),
  publicUrl: z.string().url(),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = completeSchema.parse(await request.json());
  return NextResponse.json({
    ok: true,
    file: parsed,
    message:
      "Upload completed. Persist this file against a course thumbnail or lesson resource in the next form step.",
  });
}
