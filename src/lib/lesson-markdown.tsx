import * as React from "react";
import { cn } from "@/lib/utils";

type ListBlock = {
  type: "list";
  items: string[];
};

type TextBlock = {
  type: "heading" | "quote" | "paragraph";
  text: string;
  level?: 2 | 3;
};

type ImageBlock = {
  type: "image";
  alt: string;
  src: string;
  width?: number;
  height?: number;
};

type Block = ListBlock | TextBlock | ImageBlock;

type RenderBlock =
  | Block
  | {
      type: "imageGroup";
      images: ImageBlock[];
    };

export function parseLessonMarkdown(markdown: string) {
  const blocks: Block[] = [];
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length > 0) {
      const items = normalizeListItems(list);
      if (items.length > 0) blocks.push({ type: "list", items });
      list = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 3, text: trimmed.slice(4) });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 2, text: trimmed.slice(3) });
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", text: trimmed.slice(2) });
      continue;
    }

    const imageMatch = trimmed.match(
      /^!\[(.*)]\((.*)\)(?:\{width=(\d+) height=(\d+)})?$/,
    );
    if (imageMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "image",
        alt: imageMatch[1] || "Lesson image",
        src: imageMatch[2],
        width: imageMatch[3] ? Number(imageMatch[3]) : undefined,
        height: imageMatch[4] ? Number(imageMatch[4]) : undefined,
      });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      list.push(trimmed.slice(2));
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}

export function LessonMarkdown({ content }: { content: string }) {
  const blocks = parseLessonMarkdown(content);
  const renderBlocks = groupConsecutiveImages(blocks);

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No lesson content has been added yet.
      </p>
    );
  }

  return (
    <div className="space-y-5 text-[15px] leading-7 text-foreground">
      {renderBlocks.map((block, index) => {
        if (block.type === "heading") {
          const className =
            block.level === 2
              ? "max-w-3xl pt-2 text-2xl font-semibold leading-tight text-foreground first:pt-0"
              : "max-w-3xl pt-1 text-lg font-semibold leading-snug text-foreground";
          return block.level === 2 ? (
            <h2 key={index} className={className}>
              {block.text}
            </h2>
          ) : (
            <h3 key={index} className={className}>
              {block.text}
            </h3>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={index}
              className="max-w-3xl rounded-md border bg-muted/30 px-4 py-3 text-foreground/80"
            >
              {block.text}
            </blockquote>
          );
        }

        if (block.type === "list") {
          return (
            <ul
              key={index}
              className="max-w-3xl space-y-2 rounded-md border bg-muted/25 p-4 text-foreground/85"
            >
              {block.items.map((item) => (
                <li key={item} className="grid grid-cols-[0.875rem_1fr] gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[0.7em] h-1.5 w-1.5 rounded-full bg-primary/70"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "image") {
          return <LessonImage key={index} image={block} />;
        }

        if (block.type === "imageGroup") {
          return (
            <div
              key={index}
              className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2"
            >
              {block.images.map((image) => (
                <LessonImage
                  key={`${image.alt}-${image.src.slice(0, 80)}`}
                  image={image}
                  grouped
                />
              ))}
            </div>
          );
        }

        return (
          <p key={index} className="max-w-3xl text-pretty text-foreground/80">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

function normalizeListItems(items: string[]) {
  const filtered = items.filter((item, index) => {
    if (item === "#" || isSlideCounter(item)) return false;
    return !(items[index + 1] && isSlideCounter(items[index + 1]));
  });
  const normalized: string[] = [];

  for (const item of filtered) {
    const previous = normalized.at(-1);
    if (previous && shouldMergeListItem(previous, item)) {
      normalized[normalized.length - 1] = mergeListItem(previous, item);
    } else {
      normalized.push(item);
    }
  }

  return normalized;
}

function isSlideCounter(item: string) {
  return /^\d+\s*\/\s*\d+$/.test(item);
}

function shouldMergeListItem(previous: string, next: string) {
  if (/^[,.;:!?)]/.test(next)) return true;
  if (/^[a-z]/.test(next) && !/[.!?:;)]$/.test(previous)) return true;
  return false;
}

function mergeListItem(previous: string, next: string) {
  const separator = /^[,.;:!?)]/.test(next) ? "" : " ";
  return `${previous}${separator}${next}`.replace(/\s+([,.;:!?%)])/g, "$1");
}

function groupConsecutiveImages(blocks: Block[]) {
  const grouped: RenderBlock[] = [];
  let images: ImageBlock[] = [];

  function flushImages() {
    if (images.length === 1) {
      grouped.push(images[0]);
    } else if (images.length > 1) {
      grouped.push({ type: "imageGroup", images });
    }
    images = [];
  }

  for (const block of blocks) {
    if (block.type === "image") {
      images.push(block);
    } else {
      flushImages();
      grouped.push(block);
    }
  }

  flushImages();
  return grouped;
}

function LessonImage({
  image,
  grouped = false,
}: {
  image: ImageBlock;
  grouped?: boolean;
}) {
  const aspectRatio =
    image.width && image.height ? `${image.width} / ${image.height}` : undefined;
  const figureStyle: React.CSSProperties | undefined =
    aspectRatio && !grouped ? { aspectRatio } : undefined;

  return (
    <figure
      className={cn(
        "border border-[oklch(0.86_0.012_95)] bg-[oklch(0.985_0.006_95)] shadow-sm dark:border-[oklch(0.58_0.014_95)] dark:bg-[oklch(0.93_0.008_95)]",
        grouped
          ? "flex min-h-40 items-center justify-center rounded-md p-3"
          : "overflow-hidden rounded-lg p-4 sm:p-5",
      )}
      style={figureStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.alt}
        className={
          grouped
            ? "max-h-56 max-w-full object-contain"
            : "mx-auto max-h-[680px] w-full object-contain"
        }
      />
    </figure>
  );
}
