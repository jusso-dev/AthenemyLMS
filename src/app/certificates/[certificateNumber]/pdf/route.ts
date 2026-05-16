import { NextResponse } from "next/server";
import { missingEnv } from "@/lib/env";
import { getCertificateVerification } from "@/lib/certificates";
import { generateCertificatePdf } from "@/lib/certificate-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ certificateNumber: string }> },
) {
  if (missingEnv(["DATABASE_URL"]).length > 0) {
    return NextResponse.json(
      { error: "Certificate PDF download requires DATABASE_URL." },
      { status: 503 },
    );
  }

  const { certificateNumber } = await params;
  const certificate = await getCertificateVerification(certificateNumber);
  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  const pdf = await generateCertificatePdf({
    certificateNumber: certificate.certificateNumber,
    issuedAt: certificate.issuedAt,
    recipientName: certificate.user.name,
    course: certificate.course,
  });

  const body = pdf.buffer.slice(
    pdf.byteOffset,
    pdf.byteOffset + pdf.byteLength,
  ) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${certificate.certificateNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
