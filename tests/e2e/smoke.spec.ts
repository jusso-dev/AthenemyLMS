import { expect, test } from "@playwright/test";

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Athenemy" })).toBeVisible();
  await expect(
    page.getByText("Wisdom, structured into courses.", { exact: true }),
  ).toBeVisible();
});

test("course catalogue renders", async ({ page }) => {
  await page.goto("/courses");
  await expect(page.getByRole("heading", { name: "Course catalogue" })).toBeVisible();
  await expect(page.getByText("Course Design Foundations")).toBeVisible();
});

test("dashboard route shows setup protection without Clerk", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Local setup mode")).toBeVisible();
});
