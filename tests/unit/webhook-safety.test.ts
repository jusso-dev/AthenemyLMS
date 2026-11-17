import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
const https = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("node:https", () => ({ ...https, default: https }));
vi.mock("node:dns/promises", () => ({ ...dns, default: dns }));
import {
  deliverWebhook,
  isPublicWebhookAddress,
  resolveWebhookDestination,
  validateWebhookUrl,
} from "@/lib/developer/webhook-transport";
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
} from "@/lib/developer/webhook-secrets";
afterEach(() => vi.unstubAllEnvs());
describe("webhook destination policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "198.18.0.1",
    "224.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
  ])("rejects non-public address %s", (address) =>
    expect(isPublicWebhookAddress(address)).toBe(false),
  );
  it.each([
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com:444",
    "https://localhost",
    "https://[::1]",
    "https://example.com/#fragment",
    "https://127.1",
  ])("rejects unsafe URL %s", (url) =>
    expect(() => validateWebhookUrl(url)).toThrow(),
  );
  it("rechecks all DNS answers for every attempt", async () => {
    dns.lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
    expect(
      (await resolveWebhookDestination("https://example.com/events")).address,
    ).toBe("93.184.216.34");
    dns.lookup.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(
      resolveWebhookDestination("https://example.com/events"),
    ).rejects.toThrow("public IPv4");
  });
  it("pins the HTTPS lookup and returns redirects without following them", async () => {
    dns.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const response = { statusCode: 302, destroy: vi.fn() };
    https.request.mockImplementation((_url, _options, callback) => {
      const emitter = new EventEmitter();
      return Object.assign(emitter, {
        end: () => {
          callback(response);
          emitter.emit("close");
        },
        destroy: vi.fn(),
      });
    });
    expect(
      await deliverWebhook(
        "https://example.com/hook",
        "{}",
        "t=1,v1=fixture",
        "delivery_1",
      ),
    ).toBe(302);
    expect(https.request).toHaveBeenCalledTimes(1);
    const options = https.request.mock.calls[0][1];
    const lookupResult = vi.fn();
    options.lookup("example.com", {}, lookupResult);
    expect(lookupResult).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(options.agent).toBe(false);
    expect(options.family).toBe(4);
    expect(options.rejectUnauthorized).not.toBe(false);
    expect(options.headers["x-athenemy-delivery-id"]).toBe("delivery_1");
    expect(response.destroy).toHaveBeenCalledOnce();
  });
});
describe("recoverable webhook signing keys", () => {
  it("requires an explicit encryption key", () => {
    vi.stubEnv("WEBHOOK_ENCRYPTION_KEY", "");
    expect(() => encryptWebhookSecret("whsec_test", "org_1")).toThrow(
      "WEBHOOK_ENCRYPTION_KEY",
    );
  });
  it("encrypts with authenticated organization binding and randomized nonces", () => {
    vi.stubEnv(
      "WEBHOOK_ENCRYPTION_KEY",
      Buffer.alloc(32, 7).toString("base64"),
    );
    const encrypted = encryptWebhookSecret("whsec_test", "org_1");
    expect(encrypted).not.toContain("whsec_test");
    expect(encrypted).not.toBe(encryptWebhookSecret("whsec_test", "org_1"));
    expect(decryptWebhookSecret(encrypted, "org_1")).toBe("whsec_test");
    expect(() => decryptWebhookSecret(encrypted, "org_other")).toThrow();
  });
});
