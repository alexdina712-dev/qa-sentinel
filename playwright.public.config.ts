import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
const origin = process.env.PUBLIC_BASE_URL;
if (!origin?.startsWith("https://"))
  throw new Error("Set PUBLIC_BASE_URL to the HTTPS demo.");
export default defineConfig({
  ...config,
  webServer: undefined,
  grep: /@public/,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 60000 },
  projects: config.projects?.filter(
    (p) => p.name === "desktop" || p.name === "mobile",
  ),
  use: { ...config.use, baseURL: origin, extraHTTPHeaders: { Origin: origin } },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-public-report" }],
    ["json", { outputFile: "reports/public.json" }],
  ],
});
