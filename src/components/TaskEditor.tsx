import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { ErrorNotice } from "./Feedback";
import { api, json } from "../lib/api";
import { taskSchema } from "../lib/validation";
import { statuses, priorities, type Task, type TaskInput } from "../lib/types";
export function TaskEditor({
  task,
  onClose,
  onSaved,
}: {
  task: Task | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<TaskInput>(
    task
      ? {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
        }
      : {
          title: "",
          description: "",
          status: "TODO",
          priority: "MEDIUM",
          due_date: null,
        },
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function field<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = taskSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      await api(
        task ? "/tasks/" + task.id : "/tasks",
        json(
          task ? "PUT" : "POST",
          task ? { ...parsed.data, revision: task.revision } : parsed.data,
        ),
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={task ? "Edit work item" : "Create work item"}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={save} className="form">
        <p className="muted">
          Make the next step clear. Every change is saved to your private
          workspace.
        </p>
        {error && <ErrorNotice message={error} />}
        <label>
          Title
          <input
            autoFocus
            value={data.title}
            onChange={(e) => field("title", e.target.value)}
            required
            minLength={3}
            maxLength={120}
            placeholder="What needs to happen?"
          />
        </label>
        <label>
          Description
          <textarea
            value={data.description}
            onChange={(e) => field("description", e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Context, acceptance criteria, and useful details"
          />
        </label>
        <div className="form-grid">
          <label>
            Status
            <select
              aria-label="Status"
              value={data.status}
              onChange={(e) =>
                field("status", e.target.value as TaskInput["status"])
              }
            >
              {Object.entries(statuses).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Priority"
              value={data.priority}
              onChange={(e) =>
                field("priority", e.target.value as TaskInput["priority"])
              }
            >
              {Object.entries(priorities).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Due date
          <input
            type="date"
            min="2000-01-01"
            max="2100-12-31"
            value={data.due_date || ""}
            onChange={(e) => field("due_date", e.target.value || null)}
          />
        </label>
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : task ? "Save changes" : "Create work item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
