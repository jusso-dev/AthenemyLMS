"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionFormState } from "@/lib/action-state";

type StatefulAction = (
  previousState: ActionFormState,
  formData: FormData,
) => ActionFormState | Promise<ActionFormState>;

export function ActionForm({
  action,
  children,
  className,
  initialMessage,
  inlineMessage = true,
  toast = true,
}: {
  action: StatefulAction;
  children: React.ReactNode;
  className?: string;
  initialMessage?: string | null;
  inlineMessage?: boolean;
  toast?: boolean;
}) {
  const [state, formAction] = useActionState(action, {
    status: initialMessage ? "error" : "idle",
    message: initialMessage ?? null,
  } satisfies ActionFormState);
  const hasMessage = state.status !== "idle" && state.message;

  return (
    <>
      <form action={formAction} className={className}>
        {inlineMessage && hasMessage ? <ActionMessage state={state} /> : null}
        {children}
      </form>
      {toast && hasMessage ? <ActionToast state={state} /> : null}
    </>
  );
}

export function ActionMessage({ state }: { state: ActionFormState }) {
  if (!state.message || state.status === "idle") return null;

  return (
    <p
      className={cn(
        "rounded-md border p-3 text-sm",
        state.status === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
      )}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

export function PendingSubmitButton({
  children,
  pendingLabel = "Saving...",
  disabled,
  ...props
}: ButtonProps & {
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function ActionToast({ state }: { state: ActionFormState }) {
  if (!state.message || state.status === "idle") return null;

  return (
    <div
      className={cn(
        "fixed bottom-5 right-5 z-50 max-w-sm rounded-md border bg-background px-4 py-3 text-sm shadow-lg",
        state.status === "error"
          ? "border-destructive/30 text-destructive"
          : "border-emerald-500/30 text-emerald-700 dark:text-emerald-200",
      )}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </div>
  );
}
