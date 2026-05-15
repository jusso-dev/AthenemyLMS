type EmailPayload = {
  to: string;
  name?: string;
  courseTitle?: string;
};

async function stubEmail(event: string, payload: EmailPayload) {
  if (process.env.NODE_ENV !== "test") {
    console.info(`[email:stub] ${event}`, payload);
  }
  return { provider: "stub", event, accepted: true };
}

export function sendWelcomeEmail(payload: EmailPayload) {
  return stubEmail("welcome", payload);
}

export function sendEnrollmentEmail(payload: EmailPayload) {
  return stubEmail("enrollment", payload);
}

export function sendCoursePurchaseReceipt(payload: EmailPayload) {
  return stubEmail("course_purchase_receipt", payload);
}

export function sendCoursePublishedEmail(payload: EmailPayload) {
  return stubEmail("course_published", payload);
}
