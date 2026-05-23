import { expect, test } from "@playwright/test";

async function expectNoRuntimeFailure(page: import("@playwright/test").Page) {
  await expect(page.getByText("Runtime Error")).toHaveCount(0);
  await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);
  await expect(page.getByText("Application error")).toHaveCount(0);
}

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Athenemy" })).toBeVisible();
  await expect(
    page.getByText("Wisdom, structured into courses.", { exact: true }),
  ).toBeVisible();
  await expectNoRuntimeFailure(page);
});

test("course catalogue renders", async ({ page }) => {
  await page.goto("/courses");
  await expect(
    page.getByRole("heading", { name: "Course catalogue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search courses" }),
  ).toBeVisible();
  await expectNoRuntimeFailure(page);
});

test("dashboard route renders local setup state without Clerk", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Supabase setup required")).toBeVisible();
  await expectNoRuntimeFailure(page);
});

test("default course library renders template cards", async ({ page }) => {
  await page.goto("/dashboard/courses/library");
  await expect(
    page.getByRole("heading", { name: "Default course library" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cyber Security Awareness" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Phishing Awareness" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search templates" }),
  ).toBeVisible();
  await expectNoRuntimeFailure(page);
});

test("portal builder route renders local setup state", async ({ page }) => {
  await page.goto("/dashboard/site");
  await expect(page.getByRole("heading", { name: "Portal" })).toBeVisible();
  await expect(page.getByText("Supabase setup required")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Portal/ }).first(),
  ).toBeVisible();
  await expectNoRuntimeFailure(page);
});

test("automations route surfaces execution mode and recipes", async ({
  page,
}) => {
  await page.goto("/dashboard/automations");
  await expect(
    page.getByRole("heading", { name: "Automations" }),
  ).toBeVisible();
  await expect(page.getByText("Inline execution mode")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recipes" }),
  ).toBeVisible();
  await expect(page.getByText("Enrollment welcome")).toBeVisible();
  await expectNoRuntimeFailure(page);
});

test("theme toggle persists across reloads", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("mobile dashboard keeps navigation available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  await expect(
    page.getByRole("navigation", { name: "Dashboard" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Overview/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /My courses/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Portal/ })).toBeVisible();
  await expectNoRuntimeFailure(page);
});
