import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type CertificatePdfData = {
  certificateNumber: string;
  issuedAt: Date;
  recipientName?: string | null;
  course: {
    title: string;
    instructor: { name?: string | null };
  };
};

export async function generateCertificatePdf(certificate: CertificatePdfData) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 54;

  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.09, 0.13, 0.22);
  const muted = rgb(0.36, 0.42, 0.52);
  const border = rgb(0.75, 0.63, 0.38);
  const softGold = rgb(0.96, 0.9, 0.72);
  const blue = rgb(0.12, 0.23, 0.54);

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.98, 0.98, 0.96),
  });
  page.drawRectangle({
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2,
    borderColor: border,
    borderWidth: 2,
  });
  page.drawRectangle({
    x: margin + 12,
    y: margin + 12,
    width: width - margin * 2 - 24,
    height: height - margin * 2 - 24,
    borderColor: softGold,
    borderWidth: 1,
  });

  drawCenteredText(page, "ATHENEMY", {
    y: 485,
    font: sansBold,
    size: 15,
    color: blue,
  });
  drawCenteredText(page, "Certificate of Completion", {
    y: 425,
    font: serifBold,
    size: 40,
    color: ink,
  });
  drawCenteredText(page, "Presented to", {
    y: 362,
    font: sans,
    size: 13,
    color: muted,
  });
  drawCenteredText(page, displayName(certificate.recipientName), {
    y: 318,
    font: serifBold,
    size: 30,
    color: ink,
    maxWidth: 620,
  });
  drawCenteredText(page, "for completing", {
    y: 270,
    font: sans,
    size: 13,
    color: muted,
  });
  drawCenteredText(page, certificate.course.title, {
    y: 230,
    font: serifBold,
    size: 24,
    color: ink,
    maxWidth: 640,
  });

  const issuedDate = certificate.issuedAt.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const instructor = certificate.course.instructor.name ?? "Athenemy faculty";

  page.drawText(`Issued ${issuedDate}`, {
    x: margin + 44,
    y: 135,
    font: sans,
    size: 11,
    color: muted,
  });
  page.drawText(`Instructor: ${sanitizeText(instructor)}`, {
    x: margin + 44,
    y: 112,
    font: sans,
    size: 11,
    color: muted,
  });

  const certText = `Certificate ${certificate.certificateNumber}`;
  page.drawText(certText, {
    x: width - margin - 44 - sans.widthOfTextAtSize(certText, 11),
    y: 135,
    font: sans,
    size: 11,
    color: muted,
  });
  const verifyText = "Verify this certificate at its public Athenemy URL.";
  page.drawText(verifyText, {
    x: width - margin - 44 - sans.widthOfTextAtSize(verifyText, 11),
    y: 112,
    font: sans,
    size: 11,
    color: muted,
  });

  return pdf.save();
}

function drawCenteredText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  options: {
    y: number;
    font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
    size: number;
    color: ReturnType<typeof rgb>;
    maxWidth?: number;
  },
) {
  const safeText = sanitizeText(text);
  const size = fitFontSize(
    safeText,
    options.font,
    options.size,
    options.maxWidth ?? page.getWidth() - 140,
  );
  const textWidth = options.font.widthOfTextAtSize(safeText, size);

  page.drawText(safeText, {
    x: (page.getWidth() - textWidth) / 2,
    y: options.y,
    font: options.font,
    size,
    color: options.color,
  });
}

function fitFontSize(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  preferredSize: number,
  maxWidth: number,
) {
  let size = preferredSize;
  while (size > 12 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }
  return size;
}

function displayName(name?: string | null) {
  return name?.trim() || "Certificate holder";
}

function sanitizeText(text: string) {
  return text.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}
