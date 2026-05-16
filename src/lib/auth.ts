import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { missingEnv } from "@/lib/env";
import type { Role } from "@/lib/permissions";

const appUserInclude = {
  _count: { select: { organizationMemberships: true } },
} satisfies Prisma.UserInclude;

type PersistedAppUser = Prisma.UserGetPayload<{ include: typeof appUserInclude }>;

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
  organizationMembershipCount?: number;
};

export function isClerkConfigured() {
  return (
    missingEnv(["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"])
      .length === 0
  );
}

export const getCurrentAppUser = cache(async (): Promise<AppUser | null> => {
  if (!isClerkConfigured()) return null;
  if (missingEnv(["DATABASE_URL"]).length > 0) return null;

  const { userId } = await auth();
  if (!userId) return null;

  const persistedUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: appUserInclude,
  });
  if (persistedUser) return toAppUser(persistedUser);

  const clerkUser = await currentUser();
  if (!clerkUser?.id) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    include: appUserInclude,
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

  return toAppUser(user);
});

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

function toAppUser(user: PersistedAppUser): AppUser {
  const { _count, ...appUser } = user;
  return {
    ...appUser,
    organizationMembershipCount: _count.organizationMemberships,
  } as AppUser;
}
