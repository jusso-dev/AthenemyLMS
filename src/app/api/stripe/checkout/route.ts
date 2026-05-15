import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { env, IntegrationSetupError, missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/auth";
import { mockCourses } from "@/lib/mock-data";

export async function POST(request: Request) {
  try {
    const { courseId } = (await request.json()) as { courseId?: string };
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const course =
      missingEnv(["DATABASE_URL"]).length === 0
        ? await prisma.course.findUnique({ where: { id: courseId } })
        : mockCourses.find((item) => item.id === courseId);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.priceCents === 0) {
      if (missingEnv(["DATABASE_URL"]).length === 0) {
        await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: user.id, courseId } },
          update: { status: "ACTIVE" },
          create: { userId: user.id, courseId, status: "ACTIVE" },
        });
      }
      return NextResponse.json({ url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/learn/${courseId}` });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/learn/${courseId}?checkout=success`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/courses/${course.slug}`,
      customer_email: user.email,
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

    if (missingEnv(["DATABASE_URL"]).length === 0) {
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
    }

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
