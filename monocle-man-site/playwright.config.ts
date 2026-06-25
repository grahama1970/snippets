import { defineConfig } from "@playwright/test";
import path from "node:path";

const evidenceDir = process.env.BENCHMARK_EVIDENCE_DIR || "benchmark-evidence";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(evidenceDir, "test-results.json") }]
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000
  },
  webServer: {
    command: "npm run serve",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
