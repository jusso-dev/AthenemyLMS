type EmailPayload = {
  to: string;
  name?: string;
  courseTitle?: string;
};

type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

type EmailEvent =
  | "welcome"
  | "enrollment"
  | "course_purchase_receipt"
  | "course_published";

const resendEndpoint = "https://api.resend.com/emails";

async function stubEmail(event: string, payload: EmailPayload) {
  if (process.env.NODE_ENV !== "test") {
    console.info(`[email:stub] ${event}`, payload);
  }
  return { provider: "stub", event, accepted: true };
}

async function sendEmail(
  event: EmailEvent,
  payload: EmailPayload,
  template: EmailTemplate,
) {
  if (shouldUseStub()) {
    return stubEmail(event, payload);
  }

  const provider = process.env.EMAIL_PROVIDER;
  if (provider !== "resend") {
    throw new Error(
      "Email is not configured. Set EMAIL_PROVIDER=resend and RESEND_API_KEY.",
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    throw new Error("Resend is not configured. Add RESEND_API_KEY to the environment.");
  }

  const response = await fetch(resendEndpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Athenemy <hello@example.com>",
      to: payload.to,
      subject: template.subject,
      text: template.text,
      html: template.html,
      tags: [{ name: "event", value: event }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email send failed: ${body || response.statusText}`);
  }

  const body = (await response.json()) as { id?: string };
  return { provider: "resend", event, id: body.id, accepted: true };
}

export function sendWelcomeEmail(payload: EmailPayload) {
  const name = payload.name ?? "there";
  return sendEmail("welcome", payload, {
    subject: "Welcome to Athenemy",
    text: `Welcome to Athenemy, ${name}. Your learning workspace is ready.`,
    html: `<p>Welcome to Athenemy, ${escapeHtml(name)}.</p><p>Your learning workspace is ready.</p>`,
  });
}

export function sendEnrollmentEmail(payload: EmailPayload) {
  const courseTitle = payload.courseTitle ?? "your course";
  return sendEmail("enrollment", payload, {
    subject: `You are enrolled in ${courseTitle}`,
    text: `You are enrolled in ${courseTitle}. You can resume learning from your dashboard.`,
    html: `<p>You are enrolled in <strong>${escapeHtml(courseTitle)}</strong>.</p><p>You can resume learning from your dashboard.</p>`,
  });
}

export function sendCoursePurchaseReceipt(payload: EmailPayload) {
  const courseTitle = payload.courseTitle ?? "Athenemy course";
  return sendEmail("course_purchase_receipt", payload, {
    subject: `Receipt for ${courseTitle}`,
    text: `Thanks for purchasing ${courseTitle}. Your receipt and course access are ready in Athenemy.`,
    html: `<p>Thanks for purchasing <strong>${escapeHtml(courseTitle)}</strong>.</p><p>Your receipt and course access are ready in Athenemy.</p>`,
  });
}

export function sendCoursePublishedEmail(payload: EmailPayload) {
  const courseTitle = payload.courseTitle ?? "your course";
  return sendEmail("course_published", payload, {
    subject: `${courseTitle} is published`,
    text: `${courseTitle} is now published in Athenemy.`,
    html: `<p><strong>${escapeHtml(courseTitle)}</strong> is now published in Athenemy.</p>`,
  });
}

function shouldUseStub() {
  if (process.env.NODE_ENV === "test") return true;
  return (process.env.EMAIL_PROVIDER ?? "stub") === "stub";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
