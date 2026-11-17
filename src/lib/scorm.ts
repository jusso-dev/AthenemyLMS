import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export type ScormManifest = {
  identifier: string;
  title: string;
  version: string;
  launchPath: string;
  resources: Array<{
    identifier: string;
    href: string;
    type?: string;
  }>;
};

export async function parseScorm12Manifest(data: ArrayBuffer) {
  if (data.byteLength > SCORM_LIMITS.compressedBytes)
    throw new Error("SCORM ZIP files must be 20 MB or smaller.");
  const zip = await JSZip.loadAsync(data);
  const manifestFile = zip.file("imsmanifest.xml");
  if (!manifestFile) {
    throw new Error("SCORM package is missing imsmanifest.xml.");
  }

  const xml = (
    await readBoundedEntry(manifestFile, SCORM_LIMITS.manifestBytes)
  ).toString("utf8");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error(
      "SCORM manifests must not contain document type or entity declarations.",
    );
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
  });
  const parsed = parser.parse(xml);
  const manifest = parsed.manifest;
  if (!manifest) throw new Error("SCORM manifest is invalid.");

  const metadata = manifest.metadata ?? {};
  const schema = textValue(metadata.schema);
  const version = textValue(metadata.schemaversion);
  if (schema && schema.toLowerCase() !== "adl scorm") {
    throw new Error("Only SCORM 1.2 packages are supported.");
  }
  if (version && version !== "1.2") {
    throw new Error("Only SCORM 1.2 packages are supported.");
  }

  const organizations = manifest.organizations ?? {};
  const defaultOrgId = organizations.default;
  const allOrganizations = asArray(organizations.organization);
  const organization =
    allOrganizations.find(
      (item) => isRecord(item) && item.identifier === defaultOrgId,
    ) ?? allOrganizations[0];
  const title =
    textValue(isRecord(organization) ? organization.title : undefined) ||
    textValue(manifest.metadata?.title) ||
    "SCORM package";
  const resources = normalizeResources(manifest.resources?.resource);
  const launchPath = firstLaunchFromOrganization(organization, resources);
  if (countLaunchItems(organization, resources) > 1)
    throw new Error(
      "This player supports single-SCO packages. Export one SCO per package.",
    );

  if (!launchPath) {
    throw new Error("SCORM package does not define a launch file.");
  }

  return {
    identifier:
      String(
        manifest.identifier ??
          defaultOrgId ??
          (isRecord(organization) ? organization.identifier : "") ??
          "",
      ).trim() || "scorm-package",
    title,
    version: version || "1.2",
    launchPath,
    resources,
  } satisfies ScormManifest;
}

function normalizeResources(value: unknown): ScormManifest["resources"] {
  const resources: ScormManifest["resources"] = [];

  for (const resource of asArray(value)) {
    if (isRecord(resource)) {
      const item: ScormManifest["resources"][number] = {
        identifier: String(resource.identifier ?? ""),
        href: String(resource.href ?? ""),
      };
      if (resource.type) item.type = String(resource.type);
      if (item.identifier || item.href) resources.push(item);
    }
  }

  return resources;
}

function firstLaunchFromOrganization(
  organization: unknown,
  resources: ScormManifest["resources"],
): string | null {
  if (!isRecord(organization)) return null;
  for (const item of asArray(organization.item)) {
    if (!isRecord(item)) continue;
    const identifierRef = String(item.identifierref ?? "");
    const resource = resources.find(
      (resource) => resource.identifier === identifierRef && resource.href,
    );
    if (resource) return resource.href;
    const nested: string | null = firstLaunchFromOrganization(item, resources);
    if (nested) return nested;
  }
  return null;
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (isRecord(value) && typeof value["#text"] === "string") {
    return value["#text"].trim();
  }
  return "";
}

function asArray(value: unknown) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export const SCORM_LIMITS = {
  compressedBytes: 20 * 1024 * 1024,
  expandedBytes: 80 * 1024 * 1024,
  entryBytes: 16 * 1024 * 1024,
  manifestBytes: 1024 * 1024,
  entries: 1500,
} as const;

/** Paths are relative package assets, never URLs or filesystem traversal. */
export function scormAssetPath(value: string): string {
  if (
    !value ||
    value.length > 1024 ||
    /[\\%?#:\u0000-\u001f\u007f]/.test(value) ||
    value.startsWith("/")
  ) {
    throw new Error("SCORM package contains an unsupported asset path.");
  }
  const parts = value.split("/").filter((part) => part !== ".");
  if (parts.some((part) => !part || part === "..")) {
    throw new Error("SCORM package contains an unsupported asset path.");
  }
  return parts.join("/");
}

async function readBoundedEntry(
  entry: JSZip.JSZipObject,
  limit: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const stream = entry.nodeStream("nodebuffer") as NodeJS.ReadableStream & {
      destroy(error?: Error): void;
    };
    stream.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        stream.destroy(
          new Error("SCORM package exceeds the extracted size limit."),
        );
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks, size)));
  });
}

export async function prepareScorm12Package(data: ArrayBuffer) {
  if (data.byteLength > SCORM_LIMITS.compressedBytes)
    throw new Error("SCORM ZIP files must be 20 MB or smaller.");
  const zip = await JSZip.loadAsync(data);
  const entries = Object.values(zip.files);
  if (entries.length > SCORM_LIMITS.entries)
    throw new Error("SCORM package contains too many files.");
  const assets = new Map<string, Buffer>();
  let total = 0;
  for (const entry of entries) {
    const original =
      (entry as JSZip.JSZipObject & { unsafeOriginalName?: string })
        .unsafeOriginalName ?? entry.name;
    const path = scormAssetPath(
      entry.dir ? original.replace(/\/$/, "") : original,
    );
    if (entry.dir) continue;
    if (assets.has(path))
      throw new Error("SCORM package contains duplicate asset paths.");
    const bytes = await readBoundedEntry(
      entry,
      Math.min(SCORM_LIMITS.entryBytes, SCORM_LIMITS.expandedBytes - total),
    );
    total += bytes.length;
    assets.set(path, bytes);
  }
  const manifest = await parseScorm12Manifest(data);
  const suffixIndex = manifest.launchPath.search(/[?#]/);
  const launchFile =
    suffixIndex === -1
      ? manifest.launchPath
      : manifest.launchPath.slice(0, suffixIndex);
  const suffix =
    suffixIndex === -1 ? "" : manifest.launchPath.slice(suffixIndex);
  const launchPath = scormAssetPath(launchFile);
  if (!/\.html?$/i.test(launchPath) || !assets.has(launchPath)) {
    throw new Error(
      "The SCORM launch file must be an HTML file included in the ZIP.",
    );
  }
  return { manifest: { ...manifest, launchPath: launchPath + suffix }, assets };
}

function countLaunchItems(
  organization: unknown,
  resources: ScormManifest["resources"],
): number {
  if (!isRecord(organization)) return 0;
  return asArray(organization.item).reduce<number>((count, item) => {
    if (!isRecord(item)) return count;
    const launch = resources.some(
      (resource) => resource.identifier === item.identifierref && resource.href,
    );
    return count + (launch ? 1 : 0) + countLaunchItems(item, resources);
  }, 0);
}
