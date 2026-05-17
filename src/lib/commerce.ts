import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export function validateCoupon(input: {
  active: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxRedemptions?: number | null;
  redemptionCount?: number | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!input.active) return { valid: false, reason: "Coupon is inactive." };
  if (input.startsAt && input.startsAt > now) {
    return { valid: false, reason: "Coupon is not active yet." };
  }
  if (input.endsAt && input.endsAt < now) {
    return { valid: false, reason: "Coupon has expired." };
  }
  if (
    input.maxRedemptions !== null &&
    input.maxRedemptions !== undefined &&
    (input.redemptionCount ?? 0) >= input.maxRedemptions
  ) {
    return { valid: false, reason: "Coupon redemption limit reached." };
  }
  return { valid: true, reason: null };
}

export function applyCouponToPrice(input: {
  priceCents: number;
  discountType: "PERCENT" | "AMOUNT";
  percentOff?: number | null;
  amountOffCents?: number | null;
}) {
  if (input.priceCents <= 0) return 0;
  if (input.discountType === "PERCENT") {
    const percent = Math.min(100, Math.max(0, input.percentOff ?? 0));
    return Math.max(0, Math.round(input.priceCents * (1 - percent / 100)));
  }
  return Math.max(0, input.priceCents - Math.max(0, input.amountOffCents ?? 0));
}

export async function createCourseBundle(input: {
  organizationId: string;
  title: string;
  courseIds: string[];
  priceCents?: number;
  currency?: string;
}) {
  const slug = slugify(input.title);
  return prisma.courseBundle.create({
    data: {
      organizationId: input.organizationId,
      title: input.title,
      slug,
      priceCents: input.priceCents ?? 0,
      currency: input.currency ?? "usd",
      items: {
        create: input.courseIds.map((courseId, position) => ({
          courseId,
          position,
        })),
      },
    },
  });
}
