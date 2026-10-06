import { test, expect, password } from "../support/fixtures";
import { randomUUID } from "node:crypto";
test("API-AUTH-01: protected routes reject anonymous clients", async ({
  request,
}) => {
  for (const path of ["/api/tasks", "/api/dashboard", "/api/auth/me"])
    expect((await request.get(path)).status()).toBe(401);
});
test("API-AUTH-02: bad password and malformed email have distinct validation responses", async ({
  request,
  account,
}) => {
  expect(
    (
      await request.post("/api/auth/login", {
        data: { email: account.email, password: "wrong" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/auth/login", {
        data: { email: "not-email", password },
      })
    ).status(),
  ).toBe(422);
});
test("API-CRUD-01: create, read, update, delete and verify absence", async ({
  request,
  account,
}) => {
  void account;
  const created = await request.post("/api/tasks", {
    data: { title: "HTTP contract item", priority: "HIGH" },
  });
  expect(created.status()).toBe(201);
  const item = await created.json();
  expect(item).toMatchObject({ revision: 1, status: "TODO", priority: "HIGH" });
  expect((await request.get("/api/tasks/" + item.id)).status()).toBe(200);
  const updated = await request.put("/api/tasks/" + item.id, {
    data: { title: "Finished HTTP contract", status: "DONE", revision: 1 },
  });
  expect(updated.status()).toBe(200);
  expect((await updated.json()).revision).toBe(2);
  expect(
    (await request.delete("/api/tasks/" + item.id + "?revision=2")).status(),
  ).toBe(204);
  expect((await request.get("/api/tasks/" + item.id)).status()).toBe(404);
});
test("API-EDGE-01: stale edits fail without overwriting newer data", async ({
  request,
  account,
}) => {
  void account;
  const task = await (
    await request.post("/api/tasks", { data: { title: "Conflict specimen" } })
  ).json();
  const endpoint = "/api/tasks/" + task.id;
  expect(
    (
      await request.put(endpoint, {
        data: { title: "Winning update", revision: 1 },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.put(endpoint, {
        data: { title: "Old update", revision: 1 },
      })
    ).status(),
  ).toBe(409);
  expect((await (await request.get(endpoint)).json()).title).toBe(
    "Winning update",
  );
});
for (const [label, data] of [
  ["blank title", { title: "   " }],
  ["too long", { title: "x".repeat(121) }],
  ["invalid status", { title: "Valid title", status: "UNKNOWN" }],
  ["extra owner field", { title: "Valid title", user_id: "foreign" }],
  ["impossible date", { title: "Valid title", due_date: "2026-02-30" }],
] as const) {
  test("API-NEG-01: rejects " + label, async ({ request, account }) => {
    void account;
    expect((await request.post("/api/tasks", { data })).status()).toBe(422);
    expect((await (await request.get("/api/tasks")).json()).total).toBe(0);
  });
}
test("API-SEC-01: another account cannot read or change a work item", async ({
  request,
  account,
  playwright,
  baseURL,
}) => {
  void account;
  const task = await (
    await request.post("/api/tasks", { data: { title: "Private item" } })
  ).json();
  const other = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL! },
  });
  try {
    expect((await other.post("/api/auth/demo")).status()).toBe(201);
    expect((await other.get("/api/tasks/" + task.id)).status()).toBe(404);
    expect(
      (
        await other.put("/api/tasks/" + task.id, {
          data: { title: "Unauthorized update", revision: 1 },
        })
      ).status(),
    ).toBe(404);
    expect(
      (await other.delete("/api/tasks/" + task.id + "?revision=1")).status(),
    ).toBe(404);
  } finally {
    await other.delete("/api/account", { data: { password: "DELETE DEMO" } });
    await other.dispose();
  }
});
test("API-NEG-02: nonexistent resource, query errors and bounded JSON", async ({
  request,
  account,
}) => {
  void account;
  expect((await request.get("/api/tasks/" + randomUUID())).status()).toBe(404);
  expect((await request.get("/api/tasks?page_size=51")).status()).toBe(422);
  const large = await request.post("/api/tasks", {
    data: { title: "x".repeat(33000) },
  });
  expect(large.status()).toBe(413);
  expect(large.headers()["cache-control"]).toBe("no-store");
  expect(
    (
      await request.post("/api/tasks", {
        headers: { "Content-Type": "application/json" },
        data: "{broken",
      })
    ).status(),
  ).toBe(422);
});
test("API-SEC-02: origin guard and server-side logout revocation", async ({
  request,
  account,
}) => {
  void account;
  const cookies = (await request.storageState()).cookies;
  expect(
    (
      await request.post("/api/auth/logout", {
        headers: { Origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(403);
  expect((await request.post("/api/auth/logout")).status()).toBe(204);
  expect(
    (
      await request.get("/api/auth/me", {
        headers: {
          Cookie: cookies.map((c) => c.name + "=" + c.value).join("; "),
        },
      })
    ).status(),
  ).toBe(401);
});
