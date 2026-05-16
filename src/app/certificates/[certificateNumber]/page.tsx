import { notFound } from "next/navigation";
import { Award, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SetupMessage } from "@/lib/setup-message";
import { missingEnv } from "@/lib/env";
import { getCertificateVerification } from "@/lib/certificates";

export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{ certificateNumber: string }>;
}) {
  const { certificateNumber } = await params;
  const databaseMissing = missingEnv(["DATABASE_URL"]).length > 0;
  const certificate = databaseMissing
    ? null
    : await getCertificateVerification(certificateNumber);

  if (!databaseMissing && !certificate) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      {databaseMissing ? (
        <SetupMessage
          title="Supabase setup required"
          items={["Certificate verification requires DATABASE_URL."]}
        />
      ) : null}
      <Card className="border-primary/20">
        <CardHeader className="text-center">
          <Award className="mx-auto h-12 w-12 text-[color:var(--gold)]" />
          <CardTitle className="text-3xl">Certificate verified</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            {certificate?.certificateNumber ?? certificateNumber}
          </p>
          <p className="text-xl font-semibold">
            {certificate?.course.title ?? "Athenemy course"}
          </p>
          <p className="text-sm text-muted-foreground">
            Issued by {certificate?.course.instructor.name ?? "Athenemy faculty"} on{" "}
            {certificate?.issuedAt.toLocaleDateString("en", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }) ?? "completion"}
          </p>
          <p className="text-sm text-muted-foreground">
            Verification confirms the certificate number, course, issuer, and
            issue date without exposing private learner information.
          </p>
          {!databaseMissing ? (
            <Button asChild className="mt-2">
              <a
                href={`/certificates/${certificateNumber}/pdf`}
                download={`${certificateNumber}.pdf`}
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
