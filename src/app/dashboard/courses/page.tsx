import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mockCourses } from "@/lib/mock-data";
import { formatPrice } from "@/lib/utils";

export default function ManageCoursesPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Courses</h1>
          <p className="mt-2 text-muted-foreground">
            Create, edit, publish, and inspect course performance.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/courses/new">
            <Plus className="h-4 w-4" />
            New course
          </Link>
        </Button>
      </div>
      <form className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input name="q" placeholder="Filter courses" className="pl-9" />
      </form>
      <Card>
        <CardHeader>
          <CardTitle>Course list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockCourses.map((course) => (
            <div
              key={course.id}
              className="grid gap-4 rounded-md border p-4 md:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <p className="font-medium">{course.title}</p>
                <p className="text-sm text-muted-foreground">{course.subtitle}</p>
              </div>
              <Badge variant="success">Published</Badge>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {formatPrice(course.priceCents)}
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/courses/${course.id}/edit`}>Edit</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
