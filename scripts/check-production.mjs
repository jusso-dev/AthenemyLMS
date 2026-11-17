import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Validate presence and deployment shape without returning credential values. */
export function productionIssues(values) {
  const issues = [];
  const usable = (key) => {
    const value = values[key]?.trim();
    return Boolean(value && !/placeholder|\[PASSWORD\]/i.test(value));
  };
  const required = [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET_NAME",
    "CLOUDFLARE_R2_PUBLIC_BASE_URL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SCORM_STORAGE_DIR",
    "WEBHOOK_ENCRYPTION_KEY",
  ];
  for (const key of required) {
    if (!usable(key)) issues.push(`${key} must be configured.`);
  }
  for (const key of ["NEXT_PUBLIC_APP_URL", "CLOUDFLARE_R2_PUBLIC_BASE_URL"]) {
    if (!usable(key)) continue;
    try {
      const url = new URL(values[key]);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        ["localhost", "127.0.0.1"].includes(url.hostname) ||
        url.hostname.endsWith("example.com")
      ) {
        issues.push(`${key} must be a public HTTPS URL without credentials.`);
      }
    } catch {
      issues.push(`${key} must be a valid HTTPS URL.`);
    }
  }
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    if (!usable(key)) continue;
    try {
      if (!["postgres:", "postgresql:"].includes(new URL(values[key]).protocol))
        issues.push(`${key} must be a PostgreSQL connection URL.`);
    } catch {
      issues.push(`${key} must be a valid PostgreSQL connection URL.`);
    }
  }
  if (values.EMAIL_PROVIDER !== "resend")
    issues.push(
      "EMAIL_PROVIDER must be resend; stub delivery is not production delivery.",
    );
  if (values.EMAIL_FROM?.includes("example.com"))
    issues.push("EMAIL_FROM must use your verified sender domain.");
  const stripe = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  ];
  if (stripe.some(usable)) {
    for (const key of stripe)
      if (!usable(key))
        issues.push(`${key} is required when Stripe is enabled.`);
  }
  if (usable("SCORM_STORAGE_DIR") && !isAbsolute(values.SCORM_STORAGE_DIR))
    issues.push(
      "SCORM_STORAGE_DIR must be an absolute path on a persistent private volume.",
    );
  if (
    usable("WEBHOOK_ENCRYPTION_KEY") &&
    (!/^[A-Za-z0-9+/]{43}=$/.test(values.WEBHOOK_ENCRYPTION_KEY) ||
      Buffer.from(values.WEBHOOK_ENCRYPTION_KEY, "base64").length !== 32 ||
      Buffer.from(values.WEBHOOK_ENCRYPTION_KEY, "base64").toString(
        "base64",
      ) !== values.WEBHOOK_ENCRYPTION_KEY)
  )
    issues.push(
      "WEBHOOK_ENCRYPTION_KEY must encode exactly 32 random bytes in base64.",
    );
  return issues;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { default: nextEnv } = await import("@next/env");
  nextEnv.loadEnvConfig(process.cwd(), false);
  const issues = productionIssues(process.env);
  if (issues.length) {
    console.error(
      "Production configuration is incomplete:\n" +
        issues.map((issue) => `- ${issue}`).join("\n"),
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Production configuration checks passed. Verify external services before release.",
    );
  }
}
