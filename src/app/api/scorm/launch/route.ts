import { scormAppOrigin } from "@/lib/scorm-http";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { createScormSession, ScormAccessError } from "@/lib/scorm-runtime";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== scormAppOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers },
    );
  const user = await getCurrentAppUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers },
    );
  const packageId = request.nextUrl.searchParams.get("packageId");
  if (!packageId || packageId.length > 100)
    return NextResponse.json(
      { error: "Choose a package." },
      { status: 400, headers },
    );
  try {
    return NextResponse.json(await createScormSession(packageId, user.id), {
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ScormAccessError
            ? error.message
            : "The player could not start. Try again.",
      },
      { status: error instanceof ScormAccessError ? 403 : 503, headers },
    );
  }
}
