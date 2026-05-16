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
};

type Block = ListBlock | TextBlock | ImageBlock;

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
      blocks.push({ type: "list", items: list });
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

    const imageMatch = trimmed.match(/^!\[(.*)]\((.*)\)$/);
    if (imageMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "image",
        alt: imageMatch[1] || "Lesson image",
        src: imageMatch[2],
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

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No lesson content has been added yet.
      </p>
    );
  }

  return (
    <div className="space-y-4 text-sm leading-7">
      {blocks.map((block, index) => {
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
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={index}
              src={block.src}
              alt={block.alt}
              className="max-h-[520px] rounded-md border object-contain"
            />
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
