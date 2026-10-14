import { loadTestEnv } from "./tests/env-guard";
import { defineConfig, devices } from "@playwright/test";

// E2E runs its own dev server against the Supabase TEST project from .env.test (never .env.local's project).
loadTestEnv("playwright");

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /(mobile|camera)\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true }, testMatch: /mobile\.spec/ },
    {
      name: "camera",
      testMatch: /camera\.spec/,
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["camera"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--use-file-for-fake-video-capture=e2e/.fake-camera/ticket-qr.y4m",
          ],
        },
      },
    },
  ],
  webServer: {
    // Separate dist dir so it can run alongside your normal `npm run dev`.
    command: `npx next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: { ...(process.env as Record<string, string>), NEXT_DIST_DIR: ".next-e2e" },
  },
});
