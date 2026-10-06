import { z } from "zod";
const password = (min: number) =>
  z
    .string()
    .min(min)
    .max(128)
    .refine(
      (v) => new TextEncoder().encode(v).length <= 256,
      "Password must be at most 256 UTF-8 bytes.",
    );
export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: password(1),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(80),
  password: password(10),
});
export const taskSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters.").max(120),
  description: z.string().max(2000),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  due_date: z
    .string()
    .nullable()
    .refine(
      (v) =>
        !v ||
        (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
          v >= "2000-01-01" &&
          v <= "2100-12-31" &&
          Number.isFinite(new Date(v + "T00:00:00Z").getTime()) &&
          new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v),
      "Enter a real date between 2000 and 2100.",
    ),
});
export function isOverdue(
  due: string | null,
  status: string,
  today = new Date().toISOString().slice(0, 10),
) {
  return !!due && status !== "DONE" && due < today;
}
export function displayDate(value: string | null) {
  return value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "No due date";
}
