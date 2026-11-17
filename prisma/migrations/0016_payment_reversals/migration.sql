ALTER TYPE "PaymentStatus" ADD VALUE 'DISPUTED';
ALTER TABLE "Payment" ADD COLUMN "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "stripeDisputeId" TEXT, ADD COLUMN "disputeStatus" TEXT,
 ADD COLUMN "disputeEventCreated" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "suspendedEnrollmentStatus" TEXT;
CREATE INDEX "Payment_stripePaymentId_idx" ON "Payment"("stripePaymentId");
