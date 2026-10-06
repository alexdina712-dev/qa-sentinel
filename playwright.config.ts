import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 12000 },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: "reports/playwright.xml" }],
    ["json", { outputFile: "reports/playwright.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5188",
    extraHTTPHeaders: { Origin: "http://127.0.0.1:5188" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "api", testDir: "./tests/api" },
    {
      name: "desktop",
      testDir: "./tests/ui",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "tablet",
      testDir: "./tests/ui",
      use: { ...devices["iPad Mini"], defaultBrowserType: "chromium" },
    },
    {
      name: "mobile",
      testDir: "./tests/ui",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command:
        process.platform === "win32"
          ? '".venv\\Scripts\\python.exe" -m uvicorn e2e_server:app --app-dir backend/tests --host 127.0.0.1 --port 8007'
          : "python -m uvicorn e2e_server:app --app-dir backend/tests --host 127.0.0.1 --port 8007",
      url: "http://127.0.0.1:8007/api/health",
      env: { PYTHONPATH: "backend" },
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188",
      url: "http://127.0.0.1:5188",
      env: { API_PROXY_TARGET: "http://127.0.0.1:8007" },
      reuseExistingServer: false,
    },
  ],
});
