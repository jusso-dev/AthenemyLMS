import { scormAppOrigin } from "@/lib/scorm-http";
import type { NextRequest } from "next/server";
import { getScormContentSession } from "@/lib/scorm-runtime";
import { readScormAsset } from "@/lib/scorm-storage";
import { scormAssetPath } from "@/lib/scorm";
import { scormBootstrap } from "@/lib/scorm-cmi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const types: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  xml: "application/xml",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  ogg: "audio/ogg",
  webm: "video/webm",
  wav: "audio/wav",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  pdf: "application/pdf",
  wasm: "application/wasm",
};

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ packageId: string; token: string; asset: string[] }>;
  },
) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "cross-origin",
    // Opaque-origin course content can request its own private assets using its scoped capability.
    "Access-Control-Allow-Origin": "null",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=()",
  });
  try {
    const { packageId, token, asset } = await context.params;
    const filename = scormAssetPath(asset.join("/"));
    const { item, session, cmi } = await getScormContentSession(
      packageId,
      token,
    );
    const bytes = await readScormAsset(item.storageKey!, filename);
    const extension = filename.split(".").pop()?.toLowerCase() || "";
    const base = `${scormAppOrigin(request)}/api/scorm/content/${encodeURIComponent(packageId)}/${token}/`;
    // The header also applies to direct navigation: imported scripts never gain app-origin authority.
    headers.set(
      "Content-Security-Policy",
      `sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' ${base}; style-src 'unsafe-inline' ${base}; img-src data: blob: ${base}; media-src blob: ${base}; font-src data: ${base}; connect-src ${base}; frame-src ${base}; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`,
    );
    headers.set("Content-Type", types[extension] || "application/octet-stream");
    if (extension === "html" || extension === "htm") {
      const bootstrap = scormBootstrap({
        sessionId: session.id,
        channel: token,
        sequence: session.sequence,
        cmi,
        parentOrigin: scormAppOrigin(request),
      });
      const html = bytes.toString("utf8");
      const doctype = html.match(/^(?:\uFEFF)?\s*<!doctype[^>]*>/i)?.[0];
      const document = doctype
        ? doctype + bootstrap + html.slice(doctype.length)
        : bootstrap + html;
      return new Response(document, { headers });
    }
    return new Response(new Uint8Array(bytes), { headers });
  } catch {
    return new Response(
      "This package asset is unavailable. Reload the player or contact your instructor.",
      { status: 404, headers },
    );
  }
}
