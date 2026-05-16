import { ZodError } from "zod";

export type ActionFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const initialActionState: ActionFormState = {
  status: "idle",
  message: null,
};

export function actionSuccess(message: string): ActionFormState {
  return { status: "success", message };
}

export function actionError(error: unknown): ActionFormState {
  return { status: "error", message: formatActionError(error) };
}

export function formatActionError(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the details and try again.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "That request could not be completed. Please try again.";
}
