import { expect, test } from "@playwright/test";

test("public pages expose keyboard skip and named search controls", async ({ page }) => {
  await page.goto("/courses");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await expect(page.getByRole("searchbox", { name: "Search courses" })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  } else {
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Athenemy home" }),
    ).toBeVisible();
    await expect(
      page.getByRole("banner").getByRole("link", { name: /Dashboard/ }),
    ).toBeVisible();
  }
});

test("dashboard controls expose accessible names in local setup mode", async ({ page }) => {
  await page.goto("/dashboard/courses");

  await expect(page.getByRole("searchbox", { name: "Filter courses" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Athenemy home" })).toBeVisible();
});
