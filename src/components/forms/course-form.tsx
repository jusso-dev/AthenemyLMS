"use client";

import { useActionState, useMemo } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseDefaults, courseSchema } from "@/lib/course-schemas";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CourseFormState } from "@/app/dashboard/courses/actions";
import type { z } from "zod";

type CourseFormValues = z.input<typeof courseSchema>;

export function CourseForm({
  action,
  stateAction,
  defaults,
  disabled = false,
  submitLabel = "Save course",
  initialError,
}: {
  action?: (formData: FormData) => void | Promise<void>;
  stateAction?: (
    previousState: CourseFormState,
    formData: FormData,
  ) => CourseFormState | Promise<CourseFormState>;
  defaults?: Partial<CourseFormValues>;
  disabled?: boolean;
  submitLabel?: string;
  initialError?: string;
}) {
  const initialState: CourseFormState = {
    status: initialError ? "error" : "idle",
    message: initialError ?? null,
  };
  const [state, formAction] = useActionState(
    stateAction ?? passthroughAction,
    initialState,
  );
  const initial = useMemo(
    () => ({ ...courseDefaults(), ...defaults }),
    [defaults],
  );
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: initial,
  });
  const currentError = state.status === "error" ? state.message : initialError;
  const currentSuccess = state.status === "success" ? state.message : null;

  return (
    <form
      action={stateAction ? formAction : action}
      className="grid gap-5"
      onSubmit={(event) => {
        // Cancel invalid submissions before React dispatches the form action.
        // The schema is synchronous; trigger then publishes and focuses errors.
        if (!courseSchema.safeParse(form.getValues()).success) {
          event.preventDefault();
          void form.trigger(undefined, { shouldFocus: true });
        }
      }}
      noValidate
    >
      {currentError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {currentError}
        </p>
      ) : null}
      {currentSuccess ? (
        <p
          role="status"
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200"
        >
          {currentSuccess}
        </p>
      ) : null}
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="title">
          Title
        </label>
        <Input
          id="title"
          aria-invalid={Boolean(form.formState.errors.title)}
          aria-describedby={
            form.formState.errors.title ? "title-error" : undefined
          }
          disabled={disabled}
          {...form.register("title")}
          onBlur={() => {
            if (!form.getValues("slug")) {
              form.setValue("slug", slugify(form.getValues("title")));
            }
          }}
        />
        {form.formState.errors.title ? (
          <p id="title-error" className="text-sm text-destructive" role="alert">
            {form.formState.errors.title.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="slug">
          Slug
        </label>
        <Input
          id="slug"
          aria-invalid={Boolean(form.formState.errors.slug)}
          aria-describedby={
            form.formState.errors.slug ? "slug-error" : undefined
          }
          disabled={disabled}
          {...form.register("slug")}
        />
        {form.formState.errors.slug ? (
          <p id="slug-error" className="text-sm text-destructive" role="alert">
            {form.formState.errors.slug.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="subtitle">
          Subtitle
        </label>
        <Input
          id="subtitle"
          aria-invalid={Boolean(form.formState.errors.subtitle)}
          aria-describedby={
            form.formState.errors.subtitle ? "subtitle-error" : undefined
          }
          disabled={disabled}
          {...form.register("subtitle")}
        />
        {form.formState.errors.subtitle ? (
          <p
            id="subtitle-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {form.formState.errors.subtitle.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="description">
          Description
        </label>
        <Textarea
          id="description"
          aria-invalid={Boolean(form.formState.errors.description)}
          aria-describedby={
            form.formState.errors.description ? "description-error" : undefined
          }
          disabled={disabled}
          {...form.register("description")}
        />
        {form.formState.errors.description ? (
          <p
            id="description-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {form.formState.errors.description.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="priceCents">
            Price in cents
          </label>
          <Input
            id="priceCents"
            aria-invalid={Boolean(form.formState.errors.priceCents)}
            aria-describedby={
              form.formState.errors.priceCents ? "priceCents-error" : undefined
            }
            type="number"
            disabled={disabled}
            {...form.register("priceCents")}
          />
          {form.formState.errors.priceCents ? (
            <p
              id="priceCents-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {form.formState.errors.priceCents.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            aria-invalid={Boolean(form.formState.errors.status)}
            aria-describedby={
              form.formState.errors.status ? "status-error" : undefined
            }
            disabled={disabled}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("status")}
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          {form.formState.errors.status ? (
            <p
              id="status-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {form.formState.errors.status.message}
            </p>
          ) : null}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={disabled}
          {...form.register("certificatesEnabled")}
        />
        Issue certificates for completed learners
      </label>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="thumbnailUrl">
          Thumbnail URL
        </label>
        <Input
          id="thumbnailUrl"
          aria-invalid={Boolean(form.formState.errors.thumbnailUrl)}
          aria-describedby={
            form.formState.errors.thumbnailUrl
              ? "thumbnailUrl-error"
              : undefined
          }
          disabled={disabled}
          {...form.register("thumbnailUrl")}
        />
        {form.formState.errors.thumbnailUrl ? (
          <p
            id="thumbnailUrl-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {form.formState.errors.thumbnailUrl.message}
          </p>
        ) : null}
      </div>
      <CourseSubmitButton disabled={disabled} submitLabel={submitLabel} />
    </form>
  );
}

async function passthroughAction(): Promise<CourseFormState> {
  return { status: "idle", message: null };
}

function CourseSubmitButton({
  disabled,
  submitLabel,
}: {
  disabled: boolean;
  submitLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-fit" disabled={disabled || pending}>
      {pending ? "Saving..." : submitLabel}
    </Button>
  );
}
