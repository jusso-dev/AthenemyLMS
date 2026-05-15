import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SetupMessage } from "@/lib/setup-message";
import { missingEnv } from "@/lib/env";
import { getCurrentAppUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAssessmentAction } from "@/app/dashboard/courses/actions";

export default async function CourseAssessmentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;
  const user = await getCurrentAppUser();
  const course = databaseMissing
    ? null
    : await prisma.course.findUnique({
        where: { id: courseId },
        include: { assessments: { include: { questions: true }, orderBy: { createdAt: "desc" } } },
      });
  const allowed = course ? canManageCourse(user, course) : false;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href={`/dashboard/courses/${courseId}/curriculum`}>
            <ArrowLeft className="h-4 w-4" />
            Curriculum
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">Assessments</h1>
        <p className="mt-2 text-muted-foreground">
          Add quiz checks and optional completion gates for this course.
        </p>
      </div>
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={["Assessment authoring requires DATABASE_URL and DIRECT_URL."]}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Create quiz</CardTitle>
        </CardHeader>
        <CardContent>
          {!databaseMissing && !allowed ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              Instructor or admin access is required to manage assessments.
            </p>
          ) : (
            <form action={createAssessmentAction.bind(null, courseId)} className="grid gap-4">
              <Input name="title" placeholder="Quiz title" required disabled={databaseMissing || !allowed} />
              <Textarea name="description" placeholder="Short description" disabled={databaseMissing || !allowed} />
              <Textarea name="prompt" placeholder="Question prompt" required disabled={databaseMissing || !allowed} />
              <Textarea
                name="options"
                placeholder={"Answer options, one per line"}
                required
                disabled={databaseMissing || !allowed}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="correctIndex" type="number" min="0" placeholder="Correct option index" required disabled={databaseMissing || !allowed} />
                <Input name="passingScore" type="number" min="1" max="100" defaultValue="70" disabled={databaseMissing || !allowed} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requiredForCompletion" disabled={databaseMissing || !allowed} />
                Require passing this quiz for completion
              </label>
              <Button className="w-fit" disabled={databaseMissing || !allowed}>
                <Plus className="h-4 w-4" />
                Create quiz
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Existing assessments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {course?.assessments.length === 0 ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              No assessments have been added yet.
            </p>
          ) : null}
          {course?.assessments.map((assessment) => (
            <div key={assessment.id} className="rounded-md border p-4">
              <p className="font-medium">{assessment.title}</p>
              <p className="text-sm text-muted-foreground">
                {assessment.questions.length} question · {assessment.passingScore}% to pass
                {assessment.requiredForCompletion ? " · completion gate" : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
