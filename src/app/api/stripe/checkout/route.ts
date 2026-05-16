import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { env, IntegrationSetupError, missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/auth";
import { sendEnrollmentEmail } from "@/lib/email";
import { getOrCreateStripeCustomer } from "@/lib/stripe-customers";

export async function POST(request: Request) {
  try {
    const { courseId } = (await request.json()) as { courseId?: string };
    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required" },
        { status: 400 },
      );
    }

    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

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

    if (course.priceCents === 0) {
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId } },
        update: { status: "ACTIVE" },
        create: { userId: user.id, courseId, status: "ACTIVE" },
      });
      await sendEnrollmentEmail({
        to: user.email,
        name: user.name ?? undefined,
        courseTitle: course.title,
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

    await prisma.payment.create({
      data: {
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
    if (error instanceof IntegrationSetupError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
