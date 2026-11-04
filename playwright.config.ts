import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const chrome =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45000,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: process.env.LIVE_URL || "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    launchOptions: existsSync(chrome) ? { executablePath: chrome } : {},
    trace: process.env.LIVE_URL ? "off" : "retain-on-failure",
  },
  webServer: process.env.LIVE_URL
    ? undefined
    : {
        command:
          "node node_modules/vite/bin/vite.js --mode demo --host 127.0.0.1",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
      },
  outputDir: "test-results/artifacts",
});
