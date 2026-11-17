import { Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { SetupMessage } from "@/lib/setup-message";
import { missingEnv } from "@/lib/env";
import { getCurrentAppUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueCertificateFormAction } from "@/app/dashboard/courses/actions";
import { getCertificateEligibility } from "@/lib/certificates";

export default async function CourseCertificatePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;
  const user = await getCurrentAppUser();
  const eligibility =
    !databaseMissing && user
      ? await getCertificateEligibility(user.id, courseId)
      : null;
  const existing =
    !databaseMissing && user
      ? await prisma.certificate.findUnique({
          where: { userId_courseId: { userId: user.id, courseId } },
        })
      : null;

  return (
    <div className="max-w-3xl space-y-6">
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={[
            "Course certificates require DATABASE_URL and completed enrollments.",
          ]}
        />
      ) : null}
      <Card>
        <CardHeader>
          <Award className="h-8 w-8 text-[color:var(--gold)]" />
          <CardTitle>Course certificate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {existing ? (
            <Button asChild>
              <a href={`/certificates/${existing.certificateNumber}`}>
                View certificate
              </a>
            </Button>
          ) : null}
          {!existing ? (
            <ActionForm
              action={issueCertificateFormAction.bind(null, courseId)}
            >
              <PendingSubmitButton
                disabled={databaseMissing || !user || !eligibility?.eligible}
                pendingLabel="Issuing..."
              >
                Issue certificate
              </PendingSubmitButton>
            </ActionForm>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {eligibility?.reason ??
              "Certificates are available after all lessons and required assessments are complete, when enabled by the instructor."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
