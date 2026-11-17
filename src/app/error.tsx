"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PageError({ reset }: { reset: () => void }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-2xl px-6 py-16"
    >
      <h1 className="text-2xl font-semibold">
        This page is temporarily unavailable
      </h1>
      <p className="mt-3 text-muted-foreground">
        We couldn’t load the page. Please try again in a moment.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
