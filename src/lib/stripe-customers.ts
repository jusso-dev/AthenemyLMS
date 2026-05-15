import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import type { AppUser } from "@/lib/auth";

export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  user: AppUser,
) {
  const persisted = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });

  if (persisted?.stripeCustomerId) {
    return persisted.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: {
      userId: user.id,
      clerkId: user.clerkId,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
