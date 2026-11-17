import Link from "next/link";
import { Button } from "@/components/ui/button";
export function CataloguePagination({
  page,
  pageCount,
  total,
  query,
  basePath,
}: {
  page: number;
  pageCount: number;
  total: number;
  query?: string;
  basePath: string;
}) {
  const href = (target: number) => {
    const search = new URLSearchParams({ page: String(target) });
    if (typeof query === "string" && query) search.set("q", query);
    return `${basePath}?${search.toString()}`;
  };
  return (
    <nav
      aria-label="Course catalogue pages"
      className="mt-8 flex flex-wrap items-center gap-4"
    >
      <p className="text-sm text-muted-foreground">
        {total} courses · Page {page} of {pageCount}
      </p>
      {page > 1 ? (
        <Button asChild variant="outline">
          <Link href={href(page - 1)} rel="prev">
            Previous page
          </Link>
        </Button>
      ) : null}
      {page < pageCount ? (
        <Button asChild variant="outline">
          <Link href={href(page + 1)} rel="next">
            Next page
          </Link>
        </Button>
      ) : null}
    </nav>
  );
}
