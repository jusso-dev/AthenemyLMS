"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  ActionMessage,
  PendingSubmitButton,
} from "@/components/forms/action-form";
import type { ActionFormState } from "@/lib/action-state";

type Question = { id: string; prompt: string; options: string[] };

export function AssessmentAttemptForm({
  attemptId,
  remainingMilliseconds,
  questions,
  action,
}: {
  attemptId: string;
  remainingMilliseconds: number | null;
  questions: Question[];
  action: (state: ActionFormState, data: FormData) => Promise<ActionFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
    message: null,
  } as ActionFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const autoSubmitted = useRef(false);
  const [remaining, setRemaining] = useState(remainingMilliseconds);
  useEffect(() => {
    if (remainingMilliseconds === null) return;
    const started = performance.now();
    const tick = () => {
      const milliseconds = Math.max(
        0,
        remainingMilliseconds - (performance.now() - started),
      );
      setRemaining(milliseconds);
      // Submit early enough for ordinary network latency. The server decides expiry.
      if (milliseconds <= 2000 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        formRef.current?.requestSubmit();
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [attemptId, remainingMilliseconds]);
  const seconds = remaining === null ? null : Math.ceil(remaining / 1000);
  const expired = seconds !== null && seconds <= 0;
  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <input type="hidden" name="attemptId" value={attemptId} />
      {seconds !== null ? (
        <div className="rounded-md border p-3">
          <p
            role="timer"
            aria-label="Time remaining"
            aria-live="off"
            className="font-medium tabular-nums"
          >
            Time remaining: {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, "0")}
          </p>
          <p className="text-sm text-muted-foreground">
            Your answers submit automatically just before time runs out.
            Unanswered questions receive no credit. The server enforces the
            deadline.
          </p>
          <span role="status" className="sr-only">
            {expired
              ? "Time has expired."
              : seconds <= 60
                ? "Less than one minute remaining."
                : "Timed assessment in progress."}
          </span>
        </div>
      ) : null}
      <ActionMessage state={state} />
      {questions.map((question, index) => (
        <fieldset
          key={question.id}
          className="rounded-md border p-4"
          disabled={pending || expired || state.status === "success"}
        >
          <legend className="px-1 text-sm font-medium">
            {index + 1}. {question.prompt}
          </legend>
          <div className="mt-3 space-y-2">
            {question.options.map((option, optionIndex) => (
              <label
                key={optionIndex}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={optionIndex}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <PendingSubmitButton
        disabled={state.status === "success"}
        pendingLabel="Submitting..."
      >
        {expired ? "Record expired attempt" : "Submit assessment"}
      </PendingSubmitButton>
    </form>
  );
}
