import { describe, expect, it } from "vitest";
import { applyCouponToPrice, validateCoupon } from "@/lib/commerce";

describe("commerce", () => {
  it("validates coupon lifecycle constraints", () => {
    const now = new Date("2026-05-17T00:00:00.000Z");

    expect(validateCoupon({ active: true, now })).toEqual({
      valid: true,
      reason: null,
    });
    expect(
      validateCoupon({
        active: true,
        startsAt: new Date("2026-05-18T00:00:00.000Z"),
        now,
      }).valid,
    ).toBe(false);
    expect(
      validateCoupon({
        active: true,
        maxRedemptions: 10,
        redemptionCount: 10,
        now,
      }).valid,
    ).toBe(false);
  });

  it("applies percent and amount discounts without negative totals", () => {
    expect(
      applyCouponToPrice({
        priceCents: 10000,
        discountType: "PERCENT",
        percentOff: 25,
      }),
    ).toBe(7500);
    expect(
      applyCouponToPrice({
        priceCents: 1000,
        discountType: "AMOUNT",
        amountOffCents: 5000,
      }),
    ).toBe(0);
  });
});
