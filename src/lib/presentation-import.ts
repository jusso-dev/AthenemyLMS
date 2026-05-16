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

type SlideTextBlock = {
  text: string;
  bullet: boolean;
};

type SlideImage = {
  src: string;
  width?: number;
  height?: number;
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
      buildLessonFromSlide(zip, slidePath, index, baseTitle),
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
  presentationTitle: string,
): Promise<PresentationLessonDraft> {
  const slideXml = await zip.file(slidePath)?.async("string");
  if (!slideXml) throw new Error(`Slide ${index + 1} could not be read.`);

  const parsedSlide = parser.parse(slideXml);
  const textBlocks = extractTextBlocks(parsedSlide, presentationTitle);
  const title = truncateTitle(textBlocks[0]?.text || `Slide ${index + 1}`);
  const bodyBlocks = textBlocks.slice(1);
  const images = await extractSlideImages(zip, slidePath, parsedSlide);
  const notes = await extractSpeakerNotes(zip, slidePath);

  const content = [
    `## ${title}`,
    formatTextBlocks(bodyBlocks),
    images
      .map((image, imageIndex) => {
        const dimensions =
          image.width && image.height
            ? `{width=${image.width} height=${image.height}}`
            : "";
        return `![Slide ${index + 1} image ${imageIndex + 1}](${image.src})${dimensions}`;
      })
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

async function extractSlideImages(
  zip: JSZip,
  slidePath: string,
  parsedSlide: unknown,
) {
  const relationships = await readRelationships(zip, slideRelsPath(slidePath));
  const imageRelsById = new Map(
    relationships
      .filter((rel) => rel.Type.includes("/image"))
      .map((rel) => [rel.Id, rel]),
  );
  const pictureRefs = extractPictureRefs(parsedSlide);
  const orderedRefs: Array<{ relId: string; width?: number; height?: number }> = [
    ...pictureRefs.filter((picture) => imageRelsById.has(picture.relId)),
    ...relationships
      .filter(
        (rel) =>
          rel.Type.includes("/image") &&
          !pictureRefs.some((picture) => picture.relId === rel.Id),
      )
      .map((rel) => ({ relId: rel.Id })),
  ].slice(0, MAX_IMAGES_PER_SLIDE);

  const images: SlideImage[] = [];
  for (const picture of orderedRefs) {
    const rel = imageRelsById.get(picture.relId);
    if (!rel) continue;
    const imagePath = resolveZipPath(slidePath, rel.Target);
    const file = zip.file(imagePath);
    if (!file) continue;

    const bytes = await file.async("uint8array");
    if (bytes.byteLength > MAX_IMAGE_BYTES) continue;

    const base64 = Buffer.from(bytes).toString("base64");
    images.push({
      src: `data:${mimeTypeForPath(imagePath)};base64,${base64}`,
      width: picture.width,
      height: picture.height,
    });
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
  return extractTextBlocks(node).map((block) => block.text);
}

function extractTextBlocks(
  node: unknown,
  presentationTitle?: string,
): SlideTextBlock[] {
  const blocks: SlideTextBlock[] = [];

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;
    if ("a:p" in record) {
      asArray(record["a:p"]).forEach((paragraph) => {
        const block = readParagraph(paragraph);
        if (block) blocks.push(block);
      });

      for (const [key, child] of Object.entries(record)) {
        if (key !== "a:p") visit(child);
      }
      return;
    }

    Object.values(record).forEach(visit);
  }

  visit(node);
  return dedupeAdjacent(
    blocks.filter((block) => isMeaningfulSlideText(block.text, presentationTitle)),
    (block) => block.text,
  );
}

function readParagraph(paragraph: unknown): SlideTextBlock | null {
  const fragments: string[] = [];

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;
    if (typeof record["a:t"] === "string") {
      fragments.push(record["a:t"]);
    }

    Object.values(record).forEach(visit);
  }

  visit(paragraph);
  const text = joinTextFragments(fragments);
  if (!text) return null;

  return {
    text,
    bullet: hasBulletMarker((paragraph as Record<string, unknown>)?.["a:pPr"]),
  };
}

function extractPictureRefs(node: unknown) {
  const refs: Array<{ relId: string; width?: number; height?: number }> = [];

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;
    if ("p:pic" in record) {
      asArray(record["p:pic"]).forEach((picture) => {
        const ref = readPictureRef(picture);
        if (ref) refs.push(ref);
      });

      for (const [key, child] of Object.entries(record)) {
        if (key !== "p:pic") visit(child);
      }
      return;
    }

    Object.values(record).forEach(visit);
  }

  visit(node);
  return refs;
}

function readPictureRef(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const picture = value as Record<string, unknown>;
  const blipFill = picture["p:blipFill"] as Record<string, unknown> | undefined;
  const blip = blipFill?.["a:blip"] as Record<string, unknown> | undefined;
  const relId = blip?.["r:embed"];
  if (typeof relId !== "string") return null;

  const shapeProps = picture["p:spPr"] as Record<string, unknown> | undefined;
  const transform = shapeProps?.["a:xfrm"] as Record<string, unknown> | undefined;
  const ext = transform?.["a:ext"] as Record<string, unknown> | undefined;
  const width = emuToPixels(ext?.cx);
  const height = emuToPixels(ext?.cy);

  return { relId, width, height };
}

function hasBulletMarker(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  if ("a:buNone" in record) return false;
  if (
    "a:buChar" in record ||
    "a:buAutoNum" in record ||
    "a:buBlip" in record
  ) {
    return true;
  }

  return Object.values(record).some(hasBulletMarker);
}

function joinTextFragments(fragments: string[]) {
  let text = "";

  for (const rawFragment of fragments) {
    const fragment = rawFragment.replace(/\s+/g, " ");
    const trimmed = fragment.trim();
    if (!trimmed) continue;

    if (!text) {
      text = trimmed;
      continue;
    }

    if (/^[,.;:!?%)]/.test(trimmed)) {
      text += trimmed;
    } else if (/\s$/.test(text) || /^\s/.test(fragment)) {
      text += trimmed;
    } else {
      text += ` ${trimmed}`;
    }
  }

  return text.replace(/\s+([,.;:!?%])/g, "$1").trim();
}

function isMeaningfulSlideText(text: string, presentationTitle?: string) {
  const normalized = text.trim();
  if (!normalized || normalized === "#") return false;
  if (/^\d+\s*\/\s*\d+$/.test(normalized)) return false;
  if (
    presentationTitle &&
    normalized.toLowerCase() === presentationTitle.toLowerCase()
  ) {
    return false;
  }
  return true;
}

function formatTextBlocks(blocks: SlideTextBlock[]) {
  const parts: string[] = [];
  let list: string[] = [];

  function flushList() {
    if (list.length) {
      parts.push(list.map((item) => `- ${item}`).join("\n"));
      list = [];
    }
  }

  for (const block of blocks) {
    if (block.bullet) {
      list.push(block.text);
    } else {
      flushList();
      parts.push(block.text);
    }
  }

  flushList();
  return parts.join("\n\n");
}

function dedupeAdjacent<T>(items: T[], keyFor: (item: T) => string = String) {
  return items.filter((item, index) => {
    if (index === 0) return true;
    return keyFor(item) !== keyFor(items[index - 1]);
  });
}

function emuToPixels(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return undefined;
  return Math.round(number / 9525);
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
