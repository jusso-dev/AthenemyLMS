import * as React from "react";

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
    <div className="space-y-4 text-sm leading-7">
      {renderBlocks.map((block, index) => {
        if (block.type === "heading") {
          const className =
            block.level === 2
              ? "text-xl font-semibold text-foreground"
              : "text-lg font-semibold text-foreground";
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
              className="border-l-2 border-primary pl-4 text-muted-foreground"
            >
              {block.text}
            </blockquote>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5 text-muted-foreground">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
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
          <p key={index} className="text-muted-foreground">
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

  return (
    <figure
      className={
        grouped
          ? "flex min-h-40 items-center justify-center rounded-md bg-background p-2"
          : "overflow-hidden rounded-md border bg-muted/20"
      }
      style={aspectRatio && !grouped ? { aspectRatio } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.alt}
        className={
          grouped
            ? "max-h-56 max-w-full object-contain"
            : "max-h-[680px] w-full object-contain"
        }
      />
    </figure>
  );
}
