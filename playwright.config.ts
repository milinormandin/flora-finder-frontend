import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "preview",
      testMatch: "preview.spec.ts",
      use: { baseURL: "http://localhost:3130" },
    },
    {
      name: "normal",
      testMatch: "api-states.spec.ts",
      use: { baseURL: "http://localhost:3131" },
    },
  ],
  webServer: [
    {
      command: "npm run preview -- --port 3130",
      url: "http://localhost:3130",
      env: { NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "" },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run start -- --port 3131",
      url: "http://localhost:3131",
      env: { NEXT_PUBLIC_UI_PREVIEW: "", NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "" },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
