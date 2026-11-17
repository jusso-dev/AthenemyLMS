import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";

const forbidden = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["192.88.99.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  forbidden.addSubnet(address, prefix, "ipv4");

export function isPublicWebhookAddress(address: string) {
  // IPv6 is deliberately unsupported until a complete special-purpose prefix policy is provided.
  return isIP(address) === 4 && !forbidden.check(address, "ipv4");
}
export function validateWebhookUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A valid HTTPS webhook URL is required.");
  }
  if (
    value.length > 2048 ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  )
    throw new Error(
      "Webhooks require HTTPS on port 443, without credentials or fragments.",
    );
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.startsWith("[") ||
    (isIP(host) && !isPublicWebhookAddress(host))
  )
    throw new Error("Webhook destination must have a public IPv4 address.");
  return url;
}
export async function resolveWebhookDestination(value: string) {
  const url = validateWebhookUrl(value);
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const answers = await Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(
        () => reject(new Error("Webhook DNS lookup timed out.")),
        5_000,
      );
    }),
  ]).finally(() => clearTimeout(deadline));
  if (
    !answers.length ||
    answers.some(({ address }) => !isPublicWebhookAddress(address))
  )
    throw new Error(
      "Webhook destination must resolve only to public IPv4 addresses.",
    );
  return { url, address: answers[0].address };
}

/** Resolve and validate every attempt, pin the socket to that address, retain TLS hostname verification. */
export async function deliverWebhook(
  value: string,
  body: string,
  signature: string,
  deliveryId: string,
) {
  const { url, address } = await resolveWebhookDestination(value);
  if (Buffer.byteLength(body) > 256_000)
    throw new Error("Webhook payload exceeds delivery limit.");
  return new Promise<number>((resolve, reject) => {
    const req = request(
      url,
      {
        method: "POST",
        agent: false,
        family: 4,
        lookup: (_hostname, _options, callback) => callback(null, address, 4),
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          "user-agent": "Athenemy-Webhooks/1",
          "x-athenemy-signature": signature,
          "x-athenemy-delivery-id": deliveryId,
        },
      },
      (response) => {
        // Never follow redirects or store remote response bodies, which may contain secrets.
        const status = response.statusCode ?? 0;
        response.destroy();
        resolve(status);
      },
    );
    const deadline = setTimeout(
      () => req.destroy(new Error("Webhook delivery timed out.")),
      15_000,
    );
    req.on("close", () => clearTimeout(deadline));
    req.on("error", reject);
    req.end(body);
  });
}
