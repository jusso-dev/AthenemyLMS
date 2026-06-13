import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticateApiRequest,
  createRawApiKey,
  hashApiSecret,
  requireApiScope,
  safeSecretEquals,
} from "@/lib/developer/api-keys";
import { buildOpenApiSpec } from "@/lib/developer/openapi";
import {
  buildWebhookSignatureHeader,
  signWebhookPayload,
} from "@/lib/developer/webhooks";

const mocks = vi.hoisted(() => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

describe("developer platform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.apiKey.update.mockResolvedValue({});
  });

  it("generates one-time API keys and hashes stored secrets", () => {
    const rawKey = createRawApiKey("fixed-entropy");
    const hash = hashApiSecret(rawKey);

    expect(rawKey).toBe("ath_fixed-entropy");
    expect(hash).not.toContain(rawKey);
    expect(safeSecretEquals(hash, hashApiSecret(rawKey))).toBe(true);
  });

  it("checks API scopes with standard error metadata", () => {
    expect(() =>
      requireApiScope(
        { apiKeyId: "key_1", organizationId: "org_1", scopes: ["org:read"] },
        "courses:read",
      ),
    ).toThrow("courses:read");
  });

  it("rejects authentication without a bearer header", async () => {
    const request = new Request("https://example.test/api/v1/me");
    expect(await authenticateApiRequest(request)).toBeNull();
  });

  it("authenticates active keys, updates last-used, and rejects revoked keys", async () => {
    const rawKey = createRawApiKey("integration-test");
    const keyHash = hashApiSecret(rawKey);

    mocks.prisma.apiKey.findUnique.mockResolvedValueOnce({
      id: "key_1",
      organizationId: "org_1",
      scopes: ["org:read", "courses:read"],
      revokedAt: null,
      expiresAt: null,
      keyHash,
    });

    const context = await authenticateApiRequest(
      new Request("https://example.test/api/v1/me", {
        headers: { authorization: `Bearer ${rawKey}` },
      }),
    );
    expect(context).toEqual({
      apiKeyId: "key_1",
      organizationId: "org_1",
      scopes: ["org:read", "courses:read"],
    });
    expect(mocks.prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key_1" },
      data: { lastUsedAt: expect.any(Date) },
    });

    mocks.prisma.apiKey.findUnique.mockResolvedValueOnce({
      id: "key_1",
      organizationId: "org_1",
      scopes: [],
      revokedAt: new Date(),
      expiresAt: null,
      keyHash,
    });
    expect(
      await authenticateApiRequest(
        new Request("https://example.test/api/v1/me", {
          headers: { authorization: `Bearer ${rawKey}` },
        }),
      ),
    ).toBeNull();
  });

  it("signs webhook payloads with timestamped HMAC headers", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const signature = signWebhookPayload({
      secret: "whsec_test",
      timestamp: 123,
      body,
    });

    expect(signature).toHaveLength(64);
    expect(
      buildWebhookSignatureHeader({
        secret: "whsec_test",
        timestamp: 123,
        body,
      }),
    ).toBe(`t=123,v1=${signature}`);
  });

  it("publishes an OpenAPI spec covering the v1 surface", () => {
    const spec = buildOpenApiSpec({ baseUrl: "https://example.test" });

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.servers[0].url).toBe("https://example.test/api/v1");
    const paths = Object.keys(spec.paths);
    for (const expected of [
      "/me",
      "/courses",
      "/courses/{courseId}",
      "/enrollments",
      "/progress",
      "/certificates",
      "/certificates/{certificateId}",
      "/portal/courses",
      "/webhook-endpoints",
      "/webhook-endpoints/{endpointId}",
    ]) {
      expect(paths).toContain(expected);
    }
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(spec.components.schemas.Error).toBeTruthy();
    expect(spec.components.schemas.PageInfo).toBeTruthy();
  });
});
