import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { slugify } from "@/lib/utils";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const MAX_PRESENTATION_BYTES = 40 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const MAX_IMAGES_PER_SLIDE = 6;

type Relationship = {
  Id: string;
  Type: string;
  Target: string;
};

export type PresentationLessonDraft = {
  title: string;
  slug: string;
  content: string;
  position: number;
};

export type PresentationCourseDraft = {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  durationMinutes: number;
  lessons: PresentationLessonDraft[];
};

export async function buildPresentationCourseDraft({
  data,
  fileName,
}: {
  data: ArrayBuffer;
  fileName: string;
}): Promise<PresentationCourseDraft> {
  if (data.byteLength > MAX_PRESENTATION_BYTES) {
    throw new Error("Presentation is too large. Upload a deck under 40 MB.");
  }

  const zip = await JSZip.loadAsync(data);
  const slidePaths = await getSlidePaths(zip);
  if (slidePaths.length === 0) {
    throw new Error("No slides were found in this presentation.");
  }

  const baseTitle = titleFromFileName(fileName);
  const lessons = await Promise.all(
    slidePaths.map(async (slidePath, index) =>
      buildLessonFromSlide(zip, slidePath, index),
    ),
  );

  return {
    title: baseTitle,
    slug: slugify(baseTitle),
    subtitle: `Imported from ${fileName}`,
    description:
      "Draft course generated from an uploaded presentation. Review each lesson before publishing.",
    durationMinutes: Math.max(slidePaths.length * 5, 5),
    lessons,
  };
}

export async function fetchGoogleSlidesAsPptx(url: string) {
  const exportUrl = googleSlidesExportUrl(url);
  if (!exportUrl) {
    throw new Error("Use a valid Google Slides presentation URL.");
  }

  const response = await fetch(exportUrl);
  if (!response.ok) {
    throw new Error(
      "Google Slides export failed. Make sure the deck is shared so this server can access it.",
    );
  }

  return response.arrayBuffer();
}

export function googleSlidesExportUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!parsed.hostname.endsWith("google.com")) return null;
  const match = parsed.pathname.match(/\/presentation\/d\/([^/]+)/);
  if (!match?.[1]) return null;

  return `https://docs.google.com/presentation/d/${match[1]}/export/pptx`;
}

async function getSlidePaths(zip: JSZip) {
  const presentationXml = await zip
    .file("ppt/presentation.xml")
    ?.async("string");
  if (!presentationXml) {
    throw new Error("This does not look like a PowerPoint .pptx file.");
  }

  const relationships = await readRelationships(
    zip,
    "ppt/_rels/presentation.xml.rels",
  );
  const relById = new Map(relationships.map((rel) => [rel.Id, rel]));
  const parsed = parser.parse(presentationXml);
  const slideIds = asArray(parsed?.["p:presentation"]?.["p:sldIdLst"]?.["p:sldId"]);

  return slideIds
    .map((slideId) => {
      const relId = slideId?.["r:id"];
      const target = relId ? relById.get(relId)?.Target : null;
      return target ? resolveZipPath("ppt/presentation.xml", target) : null;
    })
    .filter((path): path is string => Boolean(path && zip.file(path)));
}

async function buildLessonFromSlide(
  zip: JSZip,
  slidePath: string,
  index: number,
): Promise<PresentationLessonDraft> {
  const slideXml = await zip.file(slidePath)?.async("string");
  if (!slideXml) throw new Error(`Slide ${index + 1} could not be read.`);

  const textRuns = extractTextRuns(parser.parse(slideXml));
  const title = truncateTitle(textRuns[0] || `Slide ${index + 1}`);
  const bodyText = textRuns.slice(1);
  const images = await extractSlideImages(zip, slidePath);
  const notes = await extractSpeakerNotes(zip, slidePath);

  const content = [
    `## ${title}`,
    bodyText.length ? bodyText.map((line) => `- ${line}`).join("\n") : "",
    images
      .map((image, imageIndex) => `![Slide ${index + 1} image ${imageIndex + 1}](${image})`)
      .join("\n\n"),
    notes.length ? `### Speaker notes\n${notes.join("\n\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title,
    slug: `${slugify(title) || "slide"}-${index + 1}`,
    content,
    position: index,
  };
}

async function extractSlideImages(zip: JSZip, slidePath: string) {
  const relationships = await readRelationships(zip, slideRelsPath(slidePath));
  const imageRels = relationships
    .filter((rel) => rel.Type.includes("/image"))
    .slice(0, MAX_IMAGES_PER_SLIDE);

  const images: string[] = [];
  for (const rel of imageRels) {
    const imagePath = resolveZipPath(slidePath, rel.Target);
    const file = zip.file(imagePath);
    if (!file) continue;

    const bytes = await file.async("uint8array");
    if (bytes.byteLength > MAX_IMAGE_BYTES) continue;

    const base64 = Buffer.from(bytes).toString("base64");
    images.push(`data:${mimeTypeForPath(imagePath)};base64,${base64}`);
  }

  return images;
}

async function extractSpeakerNotes(zip: JSZip, slidePath: string) {
  const relationships = await readRelationships(zip, slideRelsPath(slidePath));
  const notesRel = relationships.find((rel) => rel.Type.includes("/notesSlide"));
  if (!notesRel) return [];

  const notesPath = resolveZipPath(slidePath, notesRel.Target);
  const notesXml = await zip.file(notesPath)?.async("string");
  if (!notesXml) return [];

  return extractTextRuns(parser.parse(notesXml));
}

async function readRelationships(zip: JSZip, path: string) {
  const xml = await zip.file(path)?.async("string");
  if (!xml) return [] as Relationship[];

  const parsed = parser.parse(xml);
  return asArray(parsed?.Relationships?.Relationship) as Relationship[];
}

function extractTextRuns(node: unknown): string[] {
  const runs: string[] = [];

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;
    if (typeof record["a:t"] === "string") {
      const text = record["a:t"].trim();
      if (text) runs.push(text);
    }

    Object.values(record).forEach(visit);
  }

  visit(node);
  return dedupeAdjacent(runs);
}

function dedupeAdjacent(items: string[]) {
  return items.filter((item, index) => item !== items[index - 1]);
}

function slideRelsPath(slidePath: string) {
  const parts = slidePath.split("/");
  const fileName = parts.pop();
  return `${parts.join("/")}/_rels/${fileName}.rels`;
}

function resolveZipPath(sourcePath: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);

  const sourceParts = sourcePath.split("/");
  sourceParts.pop();
  for (const part of target.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      sourceParts.pop();
    } else {
      sourceParts.push(part);
    }
  }

  return sourceParts.join("/");
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function titleFromFileName(fileName: string) {
  const cleanName = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  return truncateTitle(cleanName.trim() || "Imported presentation course");
}

function truncateTitle(title: string) {
  return title.length > 120 ? title.slice(0, 117).trimEnd() + "..." : title;
}

function mimeTypeForPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  if (extension === "svg") return "image/svg+xml";
  return "image/png";
}
