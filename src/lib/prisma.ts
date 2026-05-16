import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const existingClient = globalForPrisma.prisma as
  | (PrismaClient & Record<string, unknown>)
  | undefined;

if (
  process.env.NODE_ENV !== "production" &&
  existingClient &&
  !Reflect.has(existingClient, "organizationMembership")
) {
  void existingClient.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
