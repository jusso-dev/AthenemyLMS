import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { scormAssetPath } from "@/lib/scorm";

function storageRoot() {
  const configured = process.env.SCORM_STORAGE_DIR;
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error(
      "SCORM storage is not configured. Set SCORM_STORAGE_DIR to a persistent private volume.",
    );
  }
  if (
    process.env.NODE_ENV === "production" &&
    configured &&
    !path.isAbsolute(configured)
  ) {
    throw new Error("SCORM_STORAGE_DIR must be an absolute private directory.");
  }
  const root = path.resolve(configured || ".private/scorm");
  const publicPath = path.resolve("public");
  if (root === publicPath || root.startsWith(publicPath + path.sep)) {
    throw new Error("SCORM storage must be outside the public directory.");
  }
  return root;
}

async function verifyPrivateRoot() {
  const root = await realpath(storageRoot());
  const publicPath = await realpath(path.resolve("public")).catch(() =>
    path.resolve("public"),
  );
  if (root === publicPath || root.startsWith(publicPath + path.sep)) {
    throw new Error("SCORM storage must be outside the public directory.");
  }
}

function packageDirectory(key: string) {
  if (!/^[0-9a-f-]{36}$/.test(key))
    throw new Error("Invalid package storage key.");
  return path.join(storageRoot(), key);
}

export async function storeScormAssets(assets: Map<string, Buffer>) {
  await mkdir(storageRoot(), { recursive: true, mode: 0o700 });
  await verifyPrivateRoot();
  const key = randomUUID();
  const directory = packageDirectory(key);
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    for (const [asset, bytes] of assets) {
      const destination = path.join(directory, scormAssetPath(asset));
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
    }
    return key;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function removeScormAssets(key: string) {
  await rm(packageDirectory(key), { recursive: true, force: true });
}

export async function readScormAsset(key: string, asset: string) {
  await verifyPrivateRoot();
  const directory = await realpath(packageDirectory(key));
  const filename = await realpath(path.join(directory, scormAssetPath(asset)));
  if (!filename.startsWith(directory + path.sep))
    throw new Error("Invalid package asset.");
  return readFile(filename);
}
