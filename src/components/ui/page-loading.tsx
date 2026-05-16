import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden="true"
    />
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-full max-w-sm" />
      <Skeleton className="h-4 w-full max-w-xl" />
    </div>
  );
}

export function PublicPageLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <HeaderSkeleton />
          <div className="grid gap-4 sm:grid-cols-3">
            {["first", "second", "third"].map((key) => (
              <Skeleton key={key} className="h-24" />
            ))}
          </div>
          <div className="space-y-3">
            {["one", "two", "three", "four"].map((key) => (
              <Skeleton key={key} className="h-14" />
            ))}
          </div>
        </section>
        <Skeleton className="min-h-80" />
      </div>
    </main>
  );
}

export function DashboardPageLoading({
  label = "Loading workspace",
}: {
  label?: string;
}) {
  return (
    <section className="space-y-8" aria-label={label} aria-busy="true">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["one", "two", "three", "four"].map((key) => (
          <div key={key} className="rounded-md border bg-card p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-20" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-md border bg-card p-5">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 space-y-3">
            {["first", "second", "third", "fourth", "fifth"].map((key) => (
              <Skeleton key={key} className="h-12" />
            ))}
          </div>
        </div>
        <div className="rounded-md border bg-card p-5">
          <Skeleton className="h-5 w-32" />
          <div className="mt-5 space-y-4">
            {["alpha", "beta", "gamma"].map((key) => (
              <div key={key} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DetailPageLoading({ label = "Loading page" }: { label?: string }) {
  return (
    <section className="space-y-6" aria-label={label} aria-busy="true">
      <HeaderSkeleton />
      <div className="rounded-md border bg-card p-5">
        <Skeleton className="h-64 w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {["one", "two", "three"].map((key) => (
          <Skeleton key={key} className="h-28" />
        ))}
      </div>
    </section>
  );
}
