import { GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockCourses } from "@/lib/mock-data";

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = mockCourses.find((item) => item.id === courseId) ?? mockCourses[0];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Curriculum</h1>
          <p className="mt-2 text-muted-foreground">
            Reorder sections and lessons, add content, attach video URLs, and
            upload resources.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Add section
        </Button>
      </div>
      <div className="space-y-4">
        {course.sections.map((section, sectionIndex) => (
          <Card key={section.title}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>
                Section {sectionIndex + 1}: {section.title}
              </CardTitle>
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              {section.lessons.map((lesson, lessonIndex) => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {lessonIndex + 1}. {lesson.title}
                    </span>
                  </div>
                  <Button size="sm" variant="outline">
                    Edit lesson
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
