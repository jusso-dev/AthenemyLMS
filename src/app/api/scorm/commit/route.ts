import { scormAppOrigin } from "@/lib/scorm-http";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentAppUser } from "@/lib/auth";
import { commitScormProgress, ScormAccessError } from "@/lib/scorm-runtime";

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
  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json(
      { error: "JSON required." },
      { status: 415, headers },
    );
  try {
    // Cap the stream as well as Content-Length, which clients may omit.
    if (Number(request.headers.get("content-length") || 0) > 32768)
      return NextResponse.json(
        { error: "Progress payload is too large." },
        { status: 413, headers },
      );
    const reader = request.body?.getReader();
    if (!reader)
      return NextResponse.json(
        { error: "Missing progress." },
        { status: 400, headers },
      );
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Progress payload is too large." },
          { status: 413, headers },
        );
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return NextResponse.json(await commitScormProgress(user.id, body), {
      headers,
    });
  } catch (error) {
    if (error instanceof ScormAccessError)
      return NextResponse.json(
        { error: error.message },
        { status: 403, headers },
      );
    if (error instanceof ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        { error: "The package sent invalid SCORM progress." },
        { status: 400, headers },
      );
    return NextResponse.json(
      {
        error: "Progress could not be saved. Retry before leaving the player.",
      },
      { status: 503, headers },
    );
  }
}
