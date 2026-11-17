import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseForm } from "@/components/forms/course-form";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const defaults = { title: "A course", slug: "a-course", priceCents: 0 };

describe("course form validation", () => {
  it.each([
    ["slug", "not a slug"],
    ["priceCents", -1],
    ["thumbnailUrl", "not a URL"],
  ] as const)(
    "blocks an invalid %s before dispatch and exposes its error",
    async (field, value) => {
      const action = vi.fn(async () => ({
        status: "success" as const,
        message: "Saved",
      }));
      await act(async () => {
        root.render(
          <CourseForm
            stateAction={action}
            defaults={{ ...defaults, [field]: value }}
          />,
        );
      });
      const event = new Event("submit", { bubbles: true, cancelable: true });
      await act(async () => {
        container.querySelector("form")!.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
      expect(action).not.toHaveBeenCalled();
      const input = container.querySelector(`#${field}`)!;
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toBe(`${field}-error`);
      expect(container.querySelector(`#${field}-error`)?.textContent).not.toBe(
        "",
      );
      expect(document.activeElement).toBe(input);
    },
  );

  it("dispatches a valid submission once and announces the result", async () => {
    const action = vi.fn(async () => ({
      status: "success" as const,
      message: "Saved",
    }));
    await act(async () =>
      root.render(<CourseForm stateAction={action} defaults={defaults} />),
    );
    await act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(FormData),
    );
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Saved",
    );
  });
});
