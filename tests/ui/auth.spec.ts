import { test, expect, password, navigate } from "../support/fixtures";
test("UI-AUTH-01: @public protected page, invalid password, valid login, reload and logout", async ({
  page,
  account,
}) => {
  await page.goto("/tasks");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Email or password is incorrect",
  );
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A clear view, Fictional." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A clear view, Fictional." }),
  ).toBeVisible();
  await navigate(page, "Workspace");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.goto("/tasks");
  await expect(page).toHaveURL(/login/);
});
test("UI-AUTH-02: registration validation and private empty workspace", async ({
  page,
  request,
  credentials,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name").fill(credentials.name);
  await page.getByLabel("Email address").fill("bad-email");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  expect(
    await page
      .getByLabel("Email address")
      .evaluate((node: HTMLInputElement) => node.validity.typeMismatch),
  ).toBe(true);
  await page.getByLabel("Email address").fill(credentials.email);
  try {
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "A clear view, Fictional." }),
    ).toBeVisible();
    await navigate(page, "Work items");
    await expect(
      page.getByRole("heading", { name: "A clean slate" }),
    ).toBeVisible();
  } finally {
    await request.post("/api/auth/login", {
      data: { email: credentials.email, password },
    });
    await request.delete("/api/account", { data: { password } });
  }
});
test("UI-AUTH-03: @public recruiter demo has isolated fictional data and deletion controls", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore a private demo" }).click();
  await expect(
    page.getByRole("heading", { name: "A clear view, Alex." }),
  ).toBeVisible();
  await navigate(page, "Workspace");
  await page
    .getByRole("button", { name: "Delete workspace", exact: true })
    .click();
  await page.getByLabel("Type DELETE DEMO to confirm").fill("DELETE DEMO");
  await page
    .getByRole("button", { name: "Permanently delete workspace" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
