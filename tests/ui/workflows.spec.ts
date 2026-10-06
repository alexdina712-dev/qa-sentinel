import {
  test,
  expect,
  navigate,
  createFromUI,
  password,
} from "../support/fixtures";
test("UI-CRUD-01: @public create, edit, complete, activity and confirmed delete", async ({
  authedPage: page,
}) => {
  await navigate(page, "Work items");
  await createFromUI(page, "Browser release review");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Browser release review", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Description")
    .fill("Keyboard and API acceptance criteria.");
  await page
    .getByRole("dialog")
    .getByLabel("Status", { exact: true })
    .selectOption("DONE");
  await page
    .getByRole("dialog")
    .getByLabel("Priority", { exact: true })
    .selectOption("HIGH");
  await page.getByRole("dialog").getByLabel("Due date").fill("2026-11-20");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Browser release review" });
  await expect(row).toContainText("Done");
  await expect(row).toContainText("High");
  await navigate(page, "Activity");
  await expect(
    page.getByText("Work item completed", { exact: true }),
  ).toBeVisible();
  await navigate(page, "Work items");
  await page
    .getByRole("button", { name: "Delete Browser release review", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Browser release review", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Browser release review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete work item", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A clean slate" }),
  ).toBeVisible();
});
test("UI-NEG-01: whitespace validation, keyboard dismissal and literal markup", async ({
  authedPage: page,
}) => {
  await navigate(page, "Work items");
  await page
    .getByRole("button", { name: "+ Create work item", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("   ");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create work item", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("at least 3");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "+ Create work item", exact: true }),
  ).toBeFocused();
  await createFromUI(page, '<script>alert("literal")</script>');
  await expect(
    page.getByRole("button", {
      name: '<script>alert("literal")</script>',
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.locator("main script").count()).toBe(0);
});
test("UI-SEARCH-01: @public search, status filters and reset show correct rows", async ({
  authedPage: page,
  request,
}) => {
  await request.post("/api/tasks", {
    data: {
      title: "Alpha acceptance review",
      status: "DONE",
      priority: "HIGH",
    },
  });
  await request.post("/api/tasks", {
    data: { title: "Beta onboarding", status: "TODO", priority: "LOW" },
  });
  await navigate(page, "Work items");
  await page.getByLabel("Search work items").fill("Alpha");
  await expect(
    page.getByRole("button", { name: "Alpha acceptance review", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Beta onboarding", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Filter by status").selectOption("BLOCKED");
  await expect(
    page.getByRole("heading", { name: "No work items match" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Beta onboarding", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filter by priority").selectOption("HIGH");
  await expect(
    page.getByRole("button", { name: "Beta onboarding", exact: true }),
  ).toHaveCount(0);
});
test("UI-EDGE-01: stale dialog cannot overwrite another tab", async ({
  authedPage: page,
  request,
}) => {
  const task = await (
    await request.post("/api/tasks", {
      data: { title: "Concurrent work item" },
    })
  ).json();
  await navigate(page, "Work items");
  await page
    .getByRole("button", { name: "Concurrent work item", exact: true })
    .click();
  await request.put("/api/tasks/" + task.id, {
    data: { title: "Saved in another tab", revision: 1 },
  });
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Stale browser edit");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("changed in another tab");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Refresh workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Saved in another tab", exact: true }),
  ).toBeVisible();
});
test("UI-RESILIENCE-01: a failed request has a working retry and navigation fits the viewport", async ({
  authedPage: page,
}) => {
  await page.route("**/api/tasks?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporary test outage." }),
    }),
  );
  await navigate(page, "Work items");
  await expect(page.getByRole("alert")).toContainText("Temporary test outage");
  await page.unroute("**/api/tasks?*");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A clean slate" }),
  ).toBeVisible();
  for (const label of ["Overview", "Activity", "Workspace"]) {
    await navigate(page, label);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("UI-PRIVACY-01: incorrect confirmation preserves data; correct password deletes account", async ({
  authedPage: page,
}) => {
  await navigate(page, "Workspace");
  await page
    .getByRole("button", { name: "Delete workspace", exact: true })
    .click();
  await page.getByLabel("Confirm your password").fill("incorrect");
  await page
    .getByRole("button", { name: "Permanently delete workspace" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Password is incorrect");
  await page.getByLabel("Confirm your password").fill(password);
  await page
    .getByRole("button", { name: "Permanently delete workspace" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
