import Link from "next/link";
import { BookOpen, Clock, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

type CourseCardProps = {
  course: {
    title: string;
    slug: string;
    subtitle?: string | null;
    priceCents: number;
    currency?: string;
    level?: string;
    durationMinutes?: number;
    instructor?: { name?: string | null } | null;
  };
};

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="h-32 bg-[linear-gradient(135deg,var(--primary),var(--secondary))] p-5 text-primary-foreground">
        <BookOpen className="mb-8 h-6 w-6 text-amber-200" aria-hidden="true" />
        <p className="text-sm font-medium opacity-90">
          {course.instructor?.name ?? "Athenemy faculty"}
        </p>
      </div>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <Badge variant={course.priceCents === 0 ? "success" : "gold"}>
            {formatPrice(course.priceCents, course.currency)}
          </Badge>
          <span className="text-xs text-muted-foreground">{course.level}</span>
        </div>
        <CardTitle className="leading-snug">{course.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {course.subtitle}
        </p>
        <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {Math.max(1, Math.round((course.durationMinutes ?? 0) / 60))}h
          </span>
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
            Structured
          </span>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/courses/${course.slug}`}>View course</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
