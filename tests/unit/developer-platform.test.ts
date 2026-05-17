import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRawApiKey,
  hashApiSecret,
  requireApiScope,
  safeSecretEquals,
} from "@/lib/developer/api-keys";
import {
  buildWebhookSignatureHeader,
  signWebhookPayload,
} from "@/lib/developer/webhooks";

describe("developer platform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
