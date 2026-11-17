import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  membership: vi.fn(),
  author: vi.fn(),
  create: vi.fn(),
  presign: vi.fn(),
  send: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      CLOUDFLARE_R2_BUCKET_NAME: "test-value",
      CLOUDFLARE_R2_PUBLIC_BASE_URL: "https://media.example.test",
    },
  };
});
vi.mock("@/lib/auth", () => ({ getCurrentAppUser: mocks.user }));
vi.mock("@/lib/organizations", () => ({
  canManageOrganization: (
    _user: unknown,
    membership: { role: string } | null,
  ) => membership?.role === "OWNER",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMembership: {
      findUnique: mocks.membership,
      findFirst: mocks.author,
    },
    organizationAsset: { create: mocks.create },
  },
}));
vi.mock("@/lib/r2", () => ({
  createPresignedUpload: mocks.presign,
  getR2Client: () => ({ send: mocks.send }),
}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const overrides = {
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile,
    unlink: mocks.unlink,
  };
  return { ...actual, ...overrides, default: { ...actual, ...overrides } };
});
import { POST as complete } from "@/app/api/uploads/complete/route";
import { POST as presign } from "@/app/api/uploads/presign/route";
const request = (body: unknown) =>
  new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("upload routes", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CLOUDFLARE_R2_ACCOUNT_ID", "");
    mocks.user.mockResolvedValue({ id: "user_1", role: "INSTRUCTOR" });
    mocks.membership.mockResolvedValue({ role: "OWNER" });
    mocks.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: "asset_1", ...data }),
    );
    mocks.unlink.mockResolvedValue(undefined);
    mocks.presign.mockResolvedValue({
      uploadUrl: "https://storage.example.test",
    });
  });
  it("rejects unauthenticated upload completion before writing", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await complete(request({}))).status).toBe(401);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  it("rejects media writes outside an administered organisation", async () => {
    mocks.membership.mockResolvedValue(null);
    expect(
      (
        await complete(
          request({ organizationId: "org_1", fileName: "image.png" }),
        )
      ).status,
    ).toBe(403);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  it("does not accept unverified image URL claims", async () => {
    expect(
      (
        await complete(
          request({
            organizationId: "org_1",
            fileName: "image.png",
            publicUrl: "https://example.test/image.png",
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  it("uses decoded image dimensions and size instead of supplied metadata", async () => {
    const bytes = await sharp({
      create: { width: 2, height: 3, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const response = await complete(
      request({
        organizationId: "org_1",
        fileName: "image.bin",
        fileSize: 1,
        width: 999,
        dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.writeFile).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        width: 2,
        height: 3,
        mimeType: "image/png",
        storageKey: expect.stringMatching(/\.png$/),
      }),
    });
    expect(mocks.create.mock.calls[0][0].data.sizeBytes).toBeGreaterThan(1);
  });
  it("cleans up an uploaded file after database failure without disclosing details", async () => {
    const bytes = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    mocks.create.mockRejectedValue(new Error("Database diagnostic"));
    const response = await complete(
      request({
        organizationId: "org_1",
        fileName: "image.png",
        dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
      }),
    );
    expect(response.status).toBe(500);
    expect(mocks.unlink).toHaveBeenCalledOnce();
    expect(JSON.stringify(await response.json())).not.toContain(
      "Database diagnostic",
    );
  });
  it("requires authorship before issuing storage write access", async () => {
    mocks.user.mockResolvedValue({ id: "user_1", role: "STUDENT" });
    mocks.author.mockResolvedValue(null);
    expect(
      (
        await presign(
          request({
            fileName: "video.mp4",
            contentType: "video/mp4",
            fileSize: 100,
            folder: "videos",
          }),
        )
      ).status,
    ).toBe(403);
    expect(mocks.presign).not.toHaveBeenCalled();
  });
  it("passes bounded length and canonical media extension to the signer", async () => {
    expect(
      (
        await presign(
          request({
            fileName: "video.bin",
            contentType: "video/mp4",
            fileSize: 100,
            folder: "videos",
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.presign).toHaveBeenCalledWith({
      key: expect.stringMatching(/^videos\/user_1\/.*\.mp4$/),
      contentType: "video/mp4",
      sizeBytes: 100,
    });
  });
  it("rejects unsupported or oversized presigned uploads", async () => {
    expect(
      (
        await presign(
          request({
            fileName: "file.bin",
            contentType: "application/octet-stream",
            fileSize: 100,
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await presign(
          request({
            fileName: "image.png",
            contentType: "image/png",
            fileSize: 6000000,
            folder: "thumbnails",
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.presign).not.toHaveBeenCalled();
  });
  it("requires durable storage in production before writing assets", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const bytes = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const response = await complete(
      request({
        organizationId: "org_1",
        fileName: "image.png",
        dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
      }),
    );
    expect(response.status).toBe(503);
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("stores validated images in configured R2 with canonical content metadata", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const key of [
      "CLOUDFLARE_R2_ACCOUNT_ID",
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      "CLOUDFLARE_R2_BUCKET_NAME",
    ])
      vi.stubEnv(key, "test-value");
    vi.stubEnv("CLOUDFLARE_R2_PUBLIC_BASE_URL", "https://media.example.test");
    const bytes = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const response = await complete(
      request({
        organizationId: "org_1",
        fileName: "image.bin",
        dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.send.mock.calls[0][0].input).toMatchObject({
      ContentType: "image/png",
      Key: expect.stringMatching(/\.png$/),
      Body: expect.any(Buffer),
    });
    expect((await response.json()).asset.url).toMatch(
      /^https:\/\/media.example.test\/portal-assets\/org_1\//,
    );
  });
});
