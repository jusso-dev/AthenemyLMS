import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { missingEnv } from "@/lib/env";
import type { Role } from "@/lib/permissions";

export type AppUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  stripeCustomerId?: string | null;
  role: Role;
  bio?: string | null;
  websiteUrl?: string | null;
};

export function isClerkConfigured() {
  return (
    missingEnv(["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"])
      .length === 0
  );
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  if (!isClerkConfigured()) return null;

  const clerkUser = await currentUser();
  if (!clerkUser?.id) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {
      email,
      name: clerkUser.fullName,
      imageUrl: clerkUser.imageUrl,
    },
    create: {
      clerkId: clerkUser.id,
      email,
      name: clerkUser.fullName,
      imageUrl: clerkUser.imageUrl,
    },
  });

  return user as AppUser;
}

export async function requireAppUser() {
  const user = await getCurrentAppUser();
  if (!user) {
    throw new Error(
      isClerkConfigured()
        ? "Authentication required."
        : "Clerk is not configured. Add Clerk keys to .env.local.",
    );
  }
  return user;
}
