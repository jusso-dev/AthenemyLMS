"use client";

import { useMemo, useRef, useState } from "react";
import { Bold, Eye, Heading2, Italic, Link, List } from "lucide-react";
import { LessonMarkdown } from "@/lib/lesson-markdown";
import {
  ActionForm,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionFormState } from "@/lib/action-state";

type RichLessonEditorDefaults = {
  title: string;
  slug: string;
  content: string;
  videoUrl: string;
  durationMinutes: number;
  preview: boolean;
};

export function RichLessonEditor({
  action,
  defaults,
  disabled = false,
}: {
  action: (
    previousState: ActionFormState,
    formData: FormData,
  ) => ActionFormState | Promise<ActionFormState>;
  defaults: RichLessonEditorDefaults;
  disabled?: boolean;
}) {
  const [content, setContent] = useState(defaults.content);
  const [showPreview, setShowPreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preview = useMemo(() => content, [content]);

  function wrapSelection(before: string, after = before) {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || "text";
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    setContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  }

  function insertLine(prefix: string) {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;

    const start = textarea.selectionStart;
    const next = `${content.slice(0, start)}${prefix}${content.slice(start)}`;
    setContent(next);
    requestAnimationFrame(() => textarea.focus());
  }

  return (
    <ActionForm action={action} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="title">
            Lesson title
          </label>
          <Input
            id="title"
            name="title"
            defaultValue={defaults.title}
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="durationMinutes">
            Minutes
          </label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min="0"
            defaultValue={defaults.durationMinutes}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="slug">
          Slug
        </label>
        <Input
          id="slug"
          name="slug"
          defaultValue={defaults.slug}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="videoUrl">
          Video URL
        </label>
        <Input
          id="videoUrl"
          name="videoUrl"
          type="url"
          defaultValue={defaults.videoUrl}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => insertLine("## ")}
        >
          <Heading2 className="h-4 w-4" />
          Heading
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => wrapSelection("**")}
        >
          <Bold className="h-4 w-4" />
          Bold
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => wrapSelection("_")}
        >
          <Italic className="h-4 w-4" />
          Italic
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => insertLine("- ")}
        >
          <List className="h-4 w-4" />
          List
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => wrapSelection("[", "](https://)")}
        >
          <Link className="h-4 w-4" />
          Link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowPreview((value) => !value)}
        >
          <Eye className="h-4 w-4" />
          Preview
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="content">
            Lesson content
          </label>
          <Textarea
            id="content"
            name="content"
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={disabled}
            className="min-h-80 font-mono text-sm"
          />
        </div>
        {showPreview ? (
          <div className="rounded-md border bg-background p-4">
            <LessonMarkdown content={preview} />
          </div>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="preview"
          defaultChecked={defaults.preview}
          disabled={disabled}
          className="h-4 w-4"
        />
        Allow preview before enrollment
      </label>
      <PendingSubmitButton className="w-fit" disabled={disabled}>
        Save lesson
      </PendingSubmitButton>
    </ActionForm>
  );
}
