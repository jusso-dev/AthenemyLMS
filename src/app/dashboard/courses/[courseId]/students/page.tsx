import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const students = [
  { name: "Amelia Chen", progress: 86, status: "Active" },
  { name: "Jon Bell", progress: 48, status: "Active" },
  { name: "Priya Shah", progress: 100, status: "Completed" },
];

export default function CourseStudentsPage() {
  return (
    <div className="space-y-6">
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
          {students.map((student) => (
            <div
              key={student.name}
              className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_160px_auto]"
            >
              <p className="font-medium">{student.name}</p>
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
