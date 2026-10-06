"""All task access is scoped to the authenticated owner, including reads and deletes."""

from datetime import datetime, timezone, timedelta
import time
import uuid
from fastapi import HTTPException


def event(conn, user_id, action, subject):
    conn.execute(
        "INSERT INTO activity(user_id,action,subject,created_at) VALUES(?,?,?,?)",
        (user_id, action, subject, int(time.time())),
    )
    conn.execute(
        "DELETE FROM activity WHERE user_id=? AND id NOT IN (SELECT id FROM activity WHERE user_id=? ORDER BY id DESC LIMIT 100)",
        (user_id, user_id),
    )


def get_task(conn, user_id, task_id):
    row = conn.execute(
        "SELECT * FROM tasks WHERE id=? AND user_id=?", (task_id, user_id)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Work item not found.")
    result = dict(row)
    result.pop("user_id")
    return result


def create_task(conn, user_id, data):
    if conn.execute("SELECT COUNT(*) FROM tasks WHERE user_id=?", (user_id,)).fetchone()[0] >= 200:
        raise HTTPException(409, "Workspace limit reached: delete an item before adding another.")
    task_id = str(uuid.uuid4())
    now = int(time.time())
    conn.execute(
        "INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?)",
        (
            task_id,
            user_id,
            data.title,
            data.description,
            data.status,
            data.priority,
            data.due_date.isoformat() if data.due_date else None,
            1,
            now,
            now,
        ),
    )
    event(conn, user_id, "created", data.title)
    return get_task(conn, user_id, task_id)


def update_task(conn, user_id, task_id, data):
    previous = get_task(conn, user_id, task_id)
    updated = conn.execute(
        "UPDATE tasks SET title=?,description=?,status=?,priority=?,due_date=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=?",
        (
            data.title,
            data.description,
            data.status,
            data.priority,
            data.due_date.isoformat() if data.due_date else None,
            int(time.time()),
            task_id,
            user_id,
            data.revision,
        ),
    )
    if not updated.rowcount:
        raise HTTPException(409, "This item changed in another tab. Refresh before saving.")
    event(
        conn,
        user_id,
        "completed" if data.status == "DONE" and previous["status"] != "DONE" else "updated",
        data.title,
    )
    return get_task(conn, user_id, task_id)


def delete_task(conn, user_id, task_id, revision):
    task = get_task(conn, user_id, task_id)
    cursor = conn.execute(
        "DELETE FROM tasks WHERE id=? AND user_id=? AND revision=?", (task_id, user_id, revision)
    )
    if not cursor.rowcount:
        raise HTTPException(409, "This item changed. Refresh before deleting.")
    event(conn, user_id, "deleted", task["title"])


def seed(conn, user_id):
    from .schemas import TaskInput

    examples = [
        (
            "Verify checkout keyboard navigation",
            "IN_PROGRESS",
            "HIGH",
            1,
            "Walk through address, delivery and payment fields with keyboard only. Record focus order and error announcements.",
        ),
        (
            "Review release acceptance criteria",
            "TODO",
            "HIGH",
            2,
            "Agree on the release scope with the product owner and document the remaining decisions.",
        ),
        (
            "Resolve empty search results messaging",
            "BLOCKED",
            "MEDIUM",
            -2,
            "Waiting for approved copy. Preserve active filters and offer a clear reset action.",
        ),
        (
            "Confirm invoice rounding boundaries",
            "DONE",
            "HIGH",
            -1,
            "Checked fractional quantities, half-cent discounts and mixed tax rates against expected examples.",
        ),
        (
            "Prepare mobile smoke checklist",
            "TODO",
            "MEDIUM",
            3,
            "Cover sign-in, navigation, task editing and deletion at the smallest supported viewport.",
        ),
        (
            "Test expired session recovery",
            "IN_PROGRESS",
            "HIGH",
            0,
            "Confirm protected screens redirect to sign-in and show a useful message without exposing private data.",
        ),
        (
            "Update onboarding screenshots",
            "TODO",
            "LOW",
            5,
            "Capture the final empty state and a populated workspace using fictional data.",
        ),
        (
            "Check workspace isolation",
            "DONE",
            "HIGH",
            -3,
            "Verified that a second account cannot list, read, update or delete another account's work items.",
        ),
    ]
    for title, status, priority, offset, description in examples:
        create_task(
            conn,
            user_id,
            TaskInput(
                title=title,
                status=status,
                priority=priority,
                description=description,
                due_date=datetime.now(timezone.utc).date() + timedelta(days=offset),
            ),
        )
