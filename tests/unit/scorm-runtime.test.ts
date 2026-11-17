import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareScorm12Package } from "@/lib/scorm";
import {
  readScormAsset,
  removeScormAssets,
  storeScormAssets,
} from "@/lib/scorm-storage";
import {
  resumeScormCmi,
  scormBootstrap,
  scormCmiSchema,
  scormTimeSeconds,
  scormTimeString,
} from "@/lib/scorm-cmi";

const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

export function manifest(extraItem = "") {
  return `<manifest identifier="demo"><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata><organizations default="org"><organization identifier="org"><title>Demo SCO</title><item identifierref="launch"/>${extraItem}</organization></organizations><resources><resource identifier="launch" href="lesson/index.html"/></resources></manifest>`;
}

describe("private SCORM imports", () => {
  it("extracts and retrieves nested HTML and assets from private storage", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "scorm-unit-"));
    directories.push(directory);
    vi.stubEnv("SCORM_STORAGE_DIR", directory);
    const zip = new JSZip();
    zip.file("imsmanifest.xml", manifest());
    zip.file("lesson/index.html", "<!doctype html><h1>Training</h1>");
    zip.file("lesson/styles.css", "h1 { color: blue; }");
    const prepared = await prepareScorm12Package(
      await zip.generateAsync({ type: "arraybuffer" }),
    );
    expect(prepared.manifest.launchPath).toBe("lesson/index.html");
    const key = await storeScormAssets(prepared.assets);
    expect(
      (await readScormAsset(key, "lesson/styles.css")).toString(),
    ).toContain("color: blue");
    await removeScormAssets(key);
    await expect(readScormAsset(key, "lesson/index.html")).rejects.toThrow();
  });
  it("does not mark missing launch files ready", async () => {
    const zip = new JSZip();
    zip.file("imsmanifest.xml", manifest());
    await expect(
      prepareScorm12Package(await zip.generateAsync({ type: "arraybuffer" })),
    ).rejects.toThrow("included in the ZIP");
  });
  it("rejects multi-SCO organization sequencing explicitly", async () => {
    const zip = new JSZip();
    zip.file("imsmanifest.xml", manifest('<item identifierref="launch"/>'));
    zip.file("lesson/index.html", "Lesson");
    await expect(
      prepareScorm12Package(await zip.generateAsync({ type: "arraybuffer" })),
    ).rejects.toThrow("single-SCO");
  });
  it("requires an explicit private production storage directory", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SCORM_STORAGE_DIR", "");
    await expect(storeScormAssets(new Map())).rejects.toThrow("not configured");
    vi.stubEnv("SCORM_STORAGE_DIR", path.resolve("public/scorm"));
    await expect(storeScormAssets(new Map())).rejects.toThrow(
      "outside the public",
    );
  });
});

describe("SCORM 1.2 CMI subset", () => {
  it("validates status, score range, suspend data, and session time", () => {
    expect(
      scormCmiSchema.safeParse({
        "cmi.core.lesson_status": "completed",
        "cmi.core.score.raw": "85",
        "cmi.core.session_time": "0000:02:30.50",
      }).success,
    ).toBe(true);
    expect(
      scormCmiSchema.safeParse({
        "cmi.core.score.min": "90",
        "cmi.core.score.max": "80",
      }).success,
    ).toBe(false);
    expect(
      scormCmiSchema.safeParse({ "cmi.core.session_time": "0000:62:00" })
        .success,
    ).toBe(false);
    expect(
      scormCmiSchema.safeParse({ "cmi.suspend_data": "a".repeat(4097) })
        .success,
    ).toBe(false);
    expect(
      scormCmiSchema.safeParse({ "cmi.core.student_id": "other" }).success,
    ).toBe(false);
    expect(scormTimeSeconds("0001:02:03.50")).toBe(3723);
    expect(scormTimeString(3723)).toBe("0001:02:03");
    expect(
      resumeScormCmi({ cmi: { "cmi.core.lesson_location": "page2" } }),
    ).toEqual({ "cmi.core.lesson_location": "page2" });
  });
  it("implements initialize/get/set/commit/finish with a synchronous local API", () => {
    const postMessage = vi.fn();
    const window: {
      API?: Record<string, (...args: string[]) => string>;
      addEventListener: ReturnType<typeof vi.fn>;
    } = { addEventListener: vi.fn() };
    const script = scormBootstrap({
      sessionId: "session",
      channel: "channel",
      sequence: 0,
      parentOrigin: "http://localhost",
      cmi: {
        "cmi.core.lesson_location": "page2",
        "cmi.core.student_id": "student",
      },
    });
    vm.runInNewContext(script.slice(8, -9), {
      window,
      parent: { postMessage },
      setInterval: vi.fn(),
    });
    const api = window.API!;
    expect(api.LMSGetValue("cmi.core.lesson_location")).toBe("");
    expect(api.LMSGetLastError()).toBe("301");
    expect(api.LMSInitialize("")).toBe("true");
    expect(api.LMSGetValue("cmi.core.lesson_location")).toBe("page2");
    expect(api.LMSSetValue("cmi.core.student_id", "other")).toBe("false");
    expect(api.LMSSetValue("cmi.core.lesson_status", "completed")).toBe("true");
    expect(api.LMSCommit("")).toBe("true");
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sequence: 1,
        cmi: expect.objectContaining({ "cmi.core.lesson_status": "completed" }),
        finish: false,
      }),
      "http://localhost",
    );
    expect(api.LMSFinish("")).toBe("true");
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ sequence: 2, finish: true }),
      "http://localhost",
    );
    expect(api.LMSSetValue("cmi.core.lesson_location", "page3")).toBe("false");
  });
});
