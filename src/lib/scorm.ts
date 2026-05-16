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
  const zip = await JSZip.loadAsync(data);
  const manifestFile = zip.file("imsmanifest.xml");
  if (!manifestFile) {
    throw new Error("SCORM package is missing imsmanifest.xml.");
  }

  const xml = await manifestFile.async("text");
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
  if (schema && !schema.toLowerCase().includes("adl scorm")) {
    throw new Error(
      "Only SCORM 1.2 packages are supported in this foundation.",
    );
  }
  if (version && !version.includes("1.2")) {
    throw new Error(
      "Only SCORM 1.2 packages are supported in this foundation.",
    );
  }

  const organizations = manifest.organizations ?? {};
  const defaultOrgId = organizations.default;
  const organization = firstArrayItem(organizations.organization);
  const title =
    textValue(organization?.title) ||
    textValue(manifest.metadata?.title) ||
    "SCORM package";
  const resources = normalizeResources(manifest.resources?.resource);
  const launchPath =
    resources.find((resource) => resource.href)?.href ??
    firstLaunchFromOrganization(organization, resources);

  if (!launchPath) {
    throw new Error("SCORM package does not define a launch file.");
  }

  return {
    identifier:
      String(
        manifest.identifier ?? defaultOrgId ?? organization?.identifier ?? "",
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
) {
  if (!isRecord(organization)) return null;
  const item = firstArrayItem(organization.item);
  if (!isRecord(item)) return null;
  const identifierRef = String(item.identifierref ?? "");
  return resources.find((resource) => resource.identifier === identifierRef)
    ?.href;
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (isRecord(value) && typeof value["#text"] === "string") {
    return value["#text"].trim();
  }
  return "";
}

function firstArrayItem(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function asArray(value: unknown) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
