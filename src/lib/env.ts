import { z } from "zod";

const placeholderValues = new Set([
  "placeholder",
  "pk_test_placeholder",
  "sk_test_placeholder",
  "whsec_placeholder",
  "https://cdn.example.com",
]);

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default("/dashboard"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default("/dashboard"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET_NAME: z.string().optional(),
  CLOUDFLARE_R2_PUBLIC_BASE_URL: z.string().url().optional(),
  EMAIL_PROVIDER: z.string().default("stub"),
  EMAIL_FROM: z.string().default("Athenemy <hello@example.com>"),
  RESEND_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export type IntegrationName = "database" | "clerk" | "stripe" | "r2" | "email";

export class IntegrationSetupError extends Error {
  constructor(
    public readonly integration: IntegrationName,
    public readonly missing: string[],
  ) {
    super(
      `${integration} is not configured. Add ${missing.join(
        ", ",
      )} to .env.local. See docs/ENVIRONMENT.md.`,
    );
  }
}

function hasUsableValue(value: string | undefined) {
  if (!value) return false;
  return !placeholderValues.has(value) && !value.includes("[PASSWORD]");
}

export function missingEnv(keys: string[]) {
  return keys.filter((key) => !hasUsableValue(process.env[key]));
}

export function assertIntegration(
  integration: IntegrationName,
  keys: string[],
) {
  const missing = missingEnv(keys);
  if (missing.length) {
    throw new IntegrationSetupError(integration, missing);
  }
}

export function integrationStatus() {
  return {
    database: missingEnv(["DATABASE_URL", "DIRECT_URL"]).length === 0,
    clerk:
      missingEnv([
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "CLERK_SECRET_KEY",
      ]).length === 0,
    stripe:
      missingEnv(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]).length === 0,
    r2:
      missingEnv([
        "CLOUDFLARE_R2_ACCOUNT_ID",
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
        "CLOUDFLARE_R2_BUCKET_NAME",
        "CLOUDFLARE_R2_PUBLIC_BASE_URL",
      ]).length === 0,
  };
}
