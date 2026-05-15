import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder CLERK_SECRET_KEY=sk_test_placeholder DATABASE_URL= DIRECT_URL= npx next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
