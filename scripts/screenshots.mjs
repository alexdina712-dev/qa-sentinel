import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    baseURL: "http://127.0.0.1:5178",
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.screenshot({ path: "docs/screenshots/login.png", fullPage: true });
  await page.getByRole("button", { name: "Explore a private demo" }).click();
  await page.getByRole("heading", { name: "A clear view, Alex." }).waitFor();
  await page.screenshot({
    path: "docs/screenshots/overview.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /^Work items/ })
    .click();
  await page.getByRole("table").waitFor();
  await page.screenshot({
    path: "docs/screenshots/work-items.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "+ Create work item", exact: true })
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Verify the release acceptance criteria");
  await page
    .getByLabel("Description")
    .fill(
      "Review API ownership checks, keyboard navigation and the mobile regression report.",
    );
  await page.screenshot({
    path: "docs/screenshots/editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  const mobile = await browser.newContext({
    ...devices["iPhone 13"],
    baseURL: "http://127.0.0.1:5178",
    storageState: await context.storageState(),
  });
  const mp = await mobile.newPage();
  await mp.goto("/overview");
  await mp.getByRole("heading", { name: "A clear view, Alex." }).waitFor();
  await mp.screenshot({ path: "docs/screenshots/mobile.png", fullPage: true });
  await page.request.delete("/api/account", {
    data: { password: "DELETE DEMO" },
  });
  await context.close();
  await mobile.close();
  console.log(
    "Captured 5 screenshots from an isolated fictional demo; account deleted.",
  );
} finally {
  await browser.close();
}
