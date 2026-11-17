import { learningTransaction } from "@/lib/learning";
import { recordCourseEvent } from "@/lib/learning-events";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { env, IntegrationSetupError, missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/auth";
import { sendEnrollmentEmail } from "@/lib/email";
import { getOrCreateStripeCustomer } from "@/lib/stripe-customers";

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { courseId } = z
      .object({ courseId: z.string().min(1).max(200) })
      .parse(await request.json());

    if (missingEnv(["DATABASE_URL"]).length > 0) {
      return NextResponse.json(
        { error: "Supabase is not configured. Add DATABASE_URL." },
        { status: 503 },
      );
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });

    if (!course || course.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    });
    if (
      existingEnrollment?.status === "ACTIVE" ||
      existingEnrollment?.status === "COMPLETED"
    ) {
      return NextResponse.json({
        url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/learn/${courseId}`,
      });
    }

    if (course.priceCents === 0) {
      await learningTransaction(async (tx) => {
        const enrollment = await tx.enrollment.upsert({
          where: { userId_courseId: { userId: user.id, courseId } },
          update: {},
          create: { userId: user.id, courseId, status: "ACTIVE" },
        });
        await tx.enrollment.updateMany({
          where: {
            userId: user.id,
            courseId,
            status: { in: ["CANCELLED", "REFUNDED"] },
          },
          data: { status: "ACTIVE" },
        });
        await recordCourseEvent(tx, {
          userId: user.id,
          courseId,
          type: "user.enrolled",
          idempotencyKey: `free-enrollment:${enrollment.id}`,
        });
      });
      await sendEnrollmentEmail({
        to: user.email,
        name: user.name ?? undefined,
        courseTitle: course.title,
        idempotencyKey: `free-enrollment/${user.id}/${courseId}`,
      });
      return NextResponse.json({
        url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/learn/${courseId}`,
      });
    }

    const stripe = getStripe();
    const customer = await getOrCreateStripeCustomer(stripe, user);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/learn/${courseId}?checkout=success`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/courses/${course.slug}`,
      customer,
      customer_email: customer ? undefined : user.email,
      metadata: { courseId, userId: user.id },
      payment_intent_data: { metadata: { courseId, userId: user.id } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: course.currency,
            unit_amount: course.priceCents,
            product_data: {
              name: course.title,
              description: course.subtitle ?? undefined,
            },
          },
        },
      ],
    });

    await prisma.payment.upsert({
      where: { stripeSessionId: session.id },
      update: {},
      create: {
        userId: user.id,
        courseId,
        stripeSessionId: session.id,
        amountCents: course.priceCents,
        currency: course.currency,
        status: "PENDING",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "A valid courseId is required." },
        { status: 400 },
      );
    }
    if (error instanceof IntegrationSetupError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "Checkout failed. Please try again." },
      { status: 500 },
    );
  }
}
