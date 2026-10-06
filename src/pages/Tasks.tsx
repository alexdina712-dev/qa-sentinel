import { useEffect, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api, json } from "../lib/api";
import { statuses, priorities, type Task, type TaskList } from "../lib/types";
import { displayDate, isOverdue } from "../lib/validation";
import { Loading, ErrorNotice, Empty } from "../components/Feedback";
import { Modal } from "../components/Modal";
export function Tasks({
  epoch,
  edit,
  changed,
  create,
}: {
  epoch: number;
  edit: (t: Task) => void;
  changed: () => void;
  create: () => void;
}) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [page, setPage] = useState(1),
    [result, setResult] = useState<TaskList | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [deleting, setDeleting] = useState<Task | null>(null),
    [deleteError, setDeleteError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const query = new URLSearchParams({ q, page: String(page) });
      if (status) query.set("status", status);
      if (priority) query.set("priority", priority);
      api<TaskList>("/tasks?" + query)
        .then((v) => {
          if (active) setResult(v);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, status, priority, page, epoch, reload]);
  function reset() {
    setQ("");
    setStatus("");
    setPriority("");
    setPage(1);
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError("");
    try {
      await api(
        "/tasks/" + deleting.id + "?revision=" + deleting.revision,
        json("DELETE"),
      );
      setDeleting(null);
      setPage(1);
      changed();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORK, WITH INTENTION</span>
          <h1>Work items</h1>
          <p>Keep the details together. Turn a plan into progress.</p>
        </div>
        <button className="primary" onClick={create}>
          + Create work item
        </button>
      </div>
      <section className="panel">
        <div className="filters">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label="Search work items"
              placeholder="Search titles or descriptions…"
              value={q}
              maxLength={120}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <SlidersHorizontal className="filter-icon" size={17} />
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(statuses).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All priorities</option>
            {Object.entries(priorities).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          {(q || status || priority) && (
            <button className="text-button" onClick={reset}>
              Clear filters
            </button>
          )}
        </div>
        {error ? (
          <ErrorNotice message={error} retry={() => setReload((v) => v + 1)} />
        ) : loading ? (
          <Loading />
        ) : result?.items.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>WORK ITEM</th>
                    <th>STATUS</th>
                    <th>PRIORITY</th>
                    <th>DUE DATE</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <button
                          className="task-title"
                          onClick={() => edit(task)}
                        >
                          {task.title}
                        </button>
                        <p className="task-description">
                          {task.description || "No description added"}
                        </p>
                      </td>
                      <td>
                        <span className={"status-badge " + task.status}>
                          <i />
                          {statuses[task.status]}
                        </span>
                      </td>
                      <td>
                        <span className={"priority " + task.priority}>
                          <i />
                          {priorities[task.priority]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            isOverdue(task.due_date, task.status)
                              ? "overdue"
                              : ""
                          }
                        >
                          {displayDate(task.due_date)}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={"Edit " + task.title}
                            onClick={() => edit(task)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={"Delete " + task.title}
                            onClick={() => {
                              setDeleting(task);
                              setDeleteError("");
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                {result.total} work item{result.total === 1 ? "" : "s"} · Page{" "}
                {page} of {Math.max(1, Math.ceil(result.total / 12))}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={page * 12 >= result.total}
                  onClick={() => setPage((v) => v + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title={
              q || status || priority ? "No work items match" : "A clean slate"
            }
            description={
              q || status || priority
                ? "Try a different search or clear the filters."
                : "Create your first work item. Clear steps make good work easier."
            }
            action={
              <button
                className="secondary"
                onClick={q || status || priority ? reset : create}
              >
                {q || status || priority ? "Clear filters" : "Create work item"}
              </button>
            }
          />
        )}
      </section>
      {deleting && (
        <Modal
          title="Delete work item?"
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <p className="delete-copy">
            “{deleting.title}” will be permanently removed. This cannot be
            undone.
          </p>
          {deleteError && <ErrorNotice message={deleteError} />}
          <div className="dialog-actions">
            <button
              className="secondary"
              onClick={() => setDeleting(null)}
              disabled={busy}
            >
              Cancel
            </button>
            <button className="danger" onClick={remove} disabled={busy}>
              {busy ? "Deleting…" : "Delete work item"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
