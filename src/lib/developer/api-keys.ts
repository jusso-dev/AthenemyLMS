import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const apiScopes = [
  "org:read",
  "members:read",
  "members:write",
  "courses:read",
  "enrollments:read",
  "enrollments:write",
  "progress:read",
  "assessments:read",
  "certificates:read",
  "webhooks:read",
  "webhooks:write",
  "analytics:read",
] as const;

export type ApiScope = (typeof apiScopes)[number];

export type ApiAuthContext = {
  apiKeyId: string;
  organizationId: string;
  scopes: string[];
};

export function createRawApiKey(
  entropy = randomBytes(24).toString("base64url"),
) {
  return `ath_${entropy}`;
}

export function hashApiSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function safeSecretEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function createOrganizationApiKey(input: {
  organizationId: string;
  name: string;
  scopes: string[];
  createdById?: string | null;
  expiresAt?: Date | null;
}) {
  const rawKey = createRawApiKey();
  const keyPrefix = rawKey.slice(0, 12);
  const apiKey = await prisma.apiKey.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      keyPrefix,
      keyHash: hashApiSecret(rawKey),
      scopes: input.scopes.filter(isApiScope),
      createdById: input.createdById ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });

  return { apiKey, rawKey };
}

export async function authenticateApiRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const rawKey = match[1];
  const keyHash = hashApiSecret(rawKey);
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || apiKey.revokedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    apiKeyId: apiKey.id,
    organizationId: apiKey.organizationId,
    scopes: apiKey.scopes,
  } satisfies ApiAuthContext;
}

export function requireApiScope(
  context: ApiAuthContext | null,
  scope: ApiScope,
) {
  if (!context) {
    throw Object.assign(new Error("API authentication is required."), {
      code: "authentication_required",
      status: 401,
    });
  }
  if (!context.scopes.includes(scope)) {
    throw Object.assign(
      new Error(`This API key requires the ${scope} scope.`),
      {
        code: "permission_denied",
        status: 403,
      },
    );
  }
  return context;
}

export function isApiScope(scope: string): scope is ApiScope {
  return apiScopes.includes(scope as ApiScope);
}
