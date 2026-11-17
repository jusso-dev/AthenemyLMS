import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
process.env.WORKFLOW_RUN_ID ??= randomUUID();
export default defineConfig({
  testDir: "./tests/workflows",
  outputDir: "test-results/workflows",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/workflow-server.mjs",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "workflow-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "workflow-mobile", use: { ...devices["Pixel 5"] } },
  ],
});
