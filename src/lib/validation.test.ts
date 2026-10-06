import { describe, it, expect } from "vitest";
import {
  taskSchema,
  loginSchema,
  registerSchema,
  isOverdue,
} from "./validation";
const item = {
  title: "Valid item",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  due_date: null,
};
describe("client input contracts", () => {
  it.each(["2026-99-01", "2026-01-99", "2026-00-00"])(
    "rejects invalid calendar input without throwing: %s",
    (due_date) => {
      expect(taskSchema.safeParse({ ...item, due_date }).success).toBe(false);
    },
  );
  it.each([3, 120])("accepts the title boundary %i", (n) =>
    expect(
      taskSchema.safeParse({ ...item, title: "x".repeat(n) }).success,
    ).toBe(true),
  );
  it.each(["", "xx", "   ", "x".repeat(121)])(
    "rejects invalid titles: %s",
    (title) =>
      expect(taskSchema.safeParse({ ...item, title }).success).toBe(false),
  );
  it("trims titles and validates calendar dates", () => {
    expect(taskSchema.parse({ ...item, title: "  Review this  " }).title).toBe(
      "Review this",
    );
    expect(
      taskSchema.safeParse({ ...item, due_date: "2026-02-30" }).success,
    ).toBe(false);
  });
  it("validates email and password bytes consistently", () => {
    expect(
      loginSchema.safeParse({ email: "bad", password: "test" }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        name: "Tester",
        email: "a@example.com",
        password: "密".repeat(100),
      }).success,
    ).toBe(false);
  });
  it("does not treat completed work or today as overdue", () => {
    expect(isOverdue("2026-10-04", "DONE", "2026-10-05")).toBe(false);
    expect(isOverdue("2026-10-05", "TODO", "2026-10-05")).toBe(false);
    expect(isOverdue("2026-10-04", "TODO", "2026-10-05")).toBe(true);
    expect(isOverdue(null, "TODO")).toBe(false);
  });
});
