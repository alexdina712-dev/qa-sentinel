import { test as base, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
export const password = "FictionalTest!2026";
type Credentials = { name: string; email: string; password: string };
export const test = base.extend<{
  credentials: Credentials;
  account: Credentials;
  authedPage: Page;
}>({
  credentials: async ({}, use) => {
    await use({
      name: "Fictional Browser Tester",
      email: `sentinel-${randomUUID()}@example.com`,
      password,
    });
  },
  account: async ({ request, credentials }, use) => {
    expect(
      (
        await request.post("/api/auth/register", { data: credentials })
      ).status(),
    ).toBe(201);
    try {
      await use(credentials);
    } finally {
      const login = await request.post("/api/auth/login", {
        data: { email: credentials.email, password },
      });
      if (login.ok())
        expect(
          (
            await request.delete("/api/account", { data: { password } })
          ).status(),
        ).toBe(204);
    }
  },
  authedPage: async ({ account, request, context, page }, use) => {
    void account;
    await context.addCookies((await request.storageState()).cookies);
    await page.goto("/overview");
    await expect(
      page.getByRole("heading", { name: "A clear view, Fictional." }),
    ).toBeVisible();
    await use(page);
  },
});
export { expect };
export async function navigate(page: Page, label: string) {
  if (
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", {
      name: label === "Work items" ? /^Work items(?: \d+)?$/ : label,
      exact: true,
    })
    .click();
}
export async function createFromUI(page: Page, title: string) {
  await page
    .getByRole("button", { name: "+ Create work item", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill(title);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create work item", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page), "Uncaught browser errors").toEqual([]);
  const me = await page.request.get("/api/auth/me");
  if (me.ok() && (await me.json()).demo)
    expect(
      (
        await page.request.delete("/api/account", {
          data: { password: "DELETE DEMO" },
        })
      ).status(),
    ).toBe(204);
});
