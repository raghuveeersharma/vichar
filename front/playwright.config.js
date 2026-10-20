import { defineConfig } from "@playwright/test";
import process from "node:process";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    // .env is gitignored, so CI has no VITE_SERVER_URL and axios would call the
    // page's own origin. Pin it so the mocked `**/api/**` routes always match.
    env: { VITE_SERVER_URL: "http://localhost:5000/api" },
  },
});
