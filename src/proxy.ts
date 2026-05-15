import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { missingEnv } from "@/lib/env";

function clerkIsConfigured() {
  return (
    missingEnv(["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"])
      .length === 0
  );
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!clerkIsConfigured()) {
    return NextResponse.next();
  }

  const { clerkMiddleware, createRouteMatcher } = await import(
    "@clerk/nextjs/server"
  );
  const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
  const handler = clerkMiddleware(async (auth, req) => {
    if (isDashboardRoute(req)) {
      await auth.protect();
    }

    return NextResponse.next();
  });

  return handler(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
