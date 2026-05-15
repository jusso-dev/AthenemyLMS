"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseDefaults, courseSchema } from "@/lib/course-schemas";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type CourseFormValues = z.input<typeof courseSchema>;

export function CourseForm({
  action,
  defaults,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: Partial<CourseFormValues>;
}) {
  const initial = useMemo(
    () => ({ ...courseDefaults(), ...defaults }),
    [defaults],
  );
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: initial,
  });

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="title">
          Title
        </label>
        <Input
          id="title"
          {...form.register("title")}
          onBlur={() => {
            if (!form.getValues("slug")) {
              form.setValue("slug", slugify(form.getValues("title")));
            }
          }}
        />
        {form.formState.errors.title ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.title.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="slug">
          Slug
        </label>
        <Input id="slug" {...form.register("slug")} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="subtitle">
          Subtitle
        </label>
        <Input id="subtitle" {...form.register("subtitle")} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="description">
          Description
        </label>
        <Textarea id="description" {...form.register("description")} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="priceCents">
            Price in cents
          </label>
          <Input id="priceCents" type="number" {...form.register("priceCents")} />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("status")}
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="thumbnailUrl">
          Thumbnail URL
        </label>
        <Input id="thumbnailUrl" {...form.register("thumbnailUrl")} />
      </div>
      <Button type="submit" className="w-fit">
        Save course
      </Button>
    </form>
  );
}
