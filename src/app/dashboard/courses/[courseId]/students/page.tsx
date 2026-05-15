import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackNotice, getCourseStudents } from "@/lib/dashboard-data";
import { SetupMessage } from "@/lib/setup-message";

export default async function CourseStudentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await getCurrentAppUser();
  const { mode, students } = await getCourseStudents(user, courseId);

  return (
    <div className="space-y-6">
      {mode === "fallback" ? <SetupMessage {...fallbackNotice()} /> : null}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Students</h1>
        <p className="mt-2 text-muted-foreground">
          Enrollment and progress summary for this course.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Enrolled learners</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mode === "permission" ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to view course students.
            </p>
          ) : null}
          {mode !== "permission" && students.length === 0 ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              No learners are enrolled in this course yet.
            </p>
          ) : null}
          {students.map((student) => (
            <div
              key={student.email}
              className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_160px_auto]"
            >
              <div>
                <p className="font-medium">{student.name}</p>
                <p className="text-sm text-muted-foreground">{student.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-secondary"
                    style={{ width: `${student.progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {student.progress}%
                </span>
              </div>
              <Badge variant={student.status === "Completed" ? "success" : "outline"}>
                {student.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
