export type Status = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export interface User {
  id: string;
  name: string;
  email: string;
  demo: boolean;
  expires_at: number | null;
}
export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  due_date: string | null;
  revision: number;
  created_at: number;
  updated_at: number;
}
export interface TaskInput {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  due_date: string | null;
}
export interface Activity {
  id: number;
  action: string;
  subject: string;
  created_at: number;
}
export interface Dashboard {
  counts: Record<Status, number>;
  total: number;
  overdue: number;
  activity: Activity[];
}
export interface TaskList {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
}
export const statuses: Record<Status, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};
export const priorities: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};
