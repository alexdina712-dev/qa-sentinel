from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
import logging
import secrets
import sqlite3
import time
import uuid
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from .config import Settings
from .db import initialize, transaction, cleanup
from .auth import (
    COOKIE,
    DUMMY_HASH,
    current_user,
    public_user,
    hash_password,
    verify_password,
    issue_session,
    revoke_session,
)
from .schemas import Register, Login, DeleteAccount, TaskInput, TaskUpdate, Status, Priority
from .repository import seed, get_task, create_task, update_task, delete_task
from .security import SecurityMiddleware

ROOT = Path(__file__).resolve().parents[2]


def create_app(settings=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        initialize(settings.database)
        with transaction(settings.database, True) as conn:
            cleanup(conn)
        yield

    app = FastAPI(
        title="QA Sentinel API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )
    app.add_middleware(SecurityMiddleware, settings=settings)

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        return JSONResponse({"error": error.detail}, status_code=error.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        issues = [
            {"field": ".".join(str(x) for x in e["loc"][1:]), "message": e["msg"]}
            for e in error.errors()
        ]
        return JSONResponse(
            {"error": "Please check the highlighted values.", "issues": issues}, status_code=422
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request, error):
        logging.getLogger("sentinel").error("Unhandled %s", type(error).__name__)
        return JSONResponse(
            {"error": "Something went wrong. Please try again."},
            status_code=500,
            headers={"Cache-Control": "no-store"},
        )

    @app.get("/api/health")
    def health():
        with transaction(settings.database) as conn:
            conn.execute("SELECT 1")
        return {"status": "ok", "version": "1.0.0"}

    def user(conn, request):
        return current_user(conn, request.cookies.get(COOKIE))

    @app.post("/api/auth/register", status_code=201)
    def register(data: Register, response: Response):
        with transaction(settings.database, True) as conn:
            cleanup(conn)
            if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] >= 500:
                raise HTTPException(503, "Demo capacity reached. Please try again later.")
            uid = str(uuid.uuid4())
            try:
                conn.execute(
                    "INSERT INTO users VALUES(?,?,?,?,?,?,?)",
                    (
                        uid,
                        data.name,
                        data.email,
                        hash_password(data.password),
                        0,
                        None,
                        int(time.time()),
                    ),
                )
            except sqlite3.IntegrityError:
                raise HTTPException(409, "This email is already registered.") from None
            issue_session(conn, uid, response, settings)
            return public_user(
                dict(conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
            )

    @app.post("/api/auth/demo", status_code=201)
    def demo(response: Response):
        with transaction(settings.database, True) as conn:
            cleanup(conn)
            if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] >= 500:
                raise HTTPException(503, "Demo capacity reached. Please try again later.")
            uid = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO users VALUES(?,?,?,?,?,?,?)",
                (
                    uid,
                    "Alex Morgan",
                    "demo-" + uid + "@sentinel.example",
                    hash_password(secrets.token_hex(24)),
                    1,
                    int(time.time()) + settings.demo_seconds,
                    int(time.time()),
                ),
            )
            seed(conn, uid)
            issue_session(conn, uid, response, settings)
            return public_user(
                dict(conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
            )

    @app.post("/api/auth/login")
    def login(data: Login, request: Request, response: Response):
        with transaction(settings.database, True) as conn:
            cleanup(conn)
            row = conn.execute("SELECT * FROM users WHERE email=?", (data.email,)).fetchone()
            valid = verify_password(data.password, row["password_hash"] if row else DUMMY_HASH)
            if not row or not valid:
                raise HTTPException(401, "Email or password is incorrect.")
            revoke_session(conn, request.cookies.get(COOKIE))
            issue_session(conn, row["id"], response, settings)
            return public_user(dict(row))

    @app.get("/api/auth/me")
    def me(request: Request):
        with transaction(settings.database) as conn:
            return public_user(user(conn, request))

    @app.post("/api/auth/logout", status_code=204)
    def logout(request: Request, response: Response):
        with transaction(settings.database, True) as conn:
            revoke_session(conn, request.cookies.get(COOKIE))
        response.delete_cookie(
            COOKIE, path="/", secure=settings.production, httponly=True, samesite="lax"
        )
        response.status_code = 204
        return response

    @app.delete("/api/account", status_code=204)
    def delete_account(data: DeleteAccount, request: Request, response: Response):
        with transaction(settings.database, True) as conn:
            owner = user(conn, request)
            if not owner["demo"] and not verify_password(data.password, owner["password_hash"]):
                raise HTTPException(401, "Password is incorrect.")
            if owner["demo"] and data.password != "DELETE DEMO":
                raise HTTPException(422, "Type DELETE DEMO to confirm.")
            conn.execute("DELETE FROM users WHERE id=?", (owner["id"],))
        response.delete_cookie(
            COOKIE, path="/", secure=settings.production, httponly=True, samesite="lax"
        )
        response.status_code = 204
        return response

    @app.get("/api/tasks")
    def list_tasks(
        request: Request,
        q: str = Query("", max_length=120),
        status: Status | None = None,
        priority: Priority | None = None,
        page: int = Query(1, ge=1, le=10000),
        page_size: int = Query(12, ge=1, le=50),
    ):
        with transaction(settings.database) as conn:
            owner = user(conn, request)
            where, args = "user_id=?", [owner["id"]]
            if q.strip():
                # instr treats %, _, quotes and SQL-like input as literal text.
                where += (
                    " AND (instr(lower(title),lower(?))>0 OR instr(lower(description),lower(?))>0)"
                )
                args += [q.strip(), q.strip()]
            for field, value in [("status", status), ("priority", priority)]:
                if value:
                    where += " AND " + field + "=?"
                    args.append(value)
            total = conn.execute("SELECT COUNT(*) FROM tasks WHERE " + where, args).fetchone()[0]
            rows = conn.execute(
                "SELECT * FROM tasks WHERE "
                + where
                + " ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",
                [*args, page_size, (page - 1) * page_size],
            ).fetchall()
            items = []
            for row in rows:
                item = dict(row)
                item.pop("user_id")
                items.append(item)
            return {"items": items, "total": total, "page": page, "page_size": page_size}

    @app.post("/api/tasks", status_code=201)
    def create(data: TaskInput, request: Request):
        with transaction(settings.database, True) as conn:
            return create_task(conn, user(conn, request)["id"], data)

    @app.get("/api/tasks/{task_id}")
    def read(task_id: uuid.UUID, request: Request):
        with transaction(settings.database) as conn:
            return get_task(conn, user(conn, request)["id"], str(task_id))

    @app.put("/api/tasks/{task_id}")
    def update(task_id: uuid.UUID, data: TaskUpdate, request: Request):
        with transaction(settings.database, True) as conn:
            return update_task(conn, user(conn, request)["id"], str(task_id), data)

    @app.delete("/api/tasks/{task_id}", status_code=204)
    def delete(task_id: uuid.UUID, request: Request, revision: int = Query(ge=1)):
        with transaction(settings.database, True) as conn:
            delete_task(conn, user(conn, request)["id"], str(task_id), revision)
        return Response(status_code=204)

    @app.get("/api/dashboard")
    def dashboard(request: Request):
        with transaction(settings.database) as conn:
            uid = user(conn, request)["id"]
            counts = {
                row["status"]: row["n"]
                for row in conn.execute(
                    "SELECT status,COUNT(*) AS n FROM tasks WHERE user_id=? GROUP BY status", (uid,)
                )
            }
            overdue = conn.execute(
                "SELECT COUNT(*) FROM tasks WHERE user_id=? AND status!='DONE' AND due_date<?",
                (uid, datetime.now(timezone.utc).date().isoformat()),
            ).fetchone()[0]
            return {
                "counts": {s: counts.get(s, 0) for s in ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]},
                "total": sum(counts.values()),
                "overdue": overdue,
                "activity": [
                    dict(row)
                    for row in conn.execute(
                        "SELECT id,action,subject,created_at FROM activity WHERE user_id=? ORDER BY id DESC LIMIT 30",
                        (uid,),
                    )
                ],
            }

    if (ROOT / "dist").is_dir():
        app.mount("/assets", StaticFiles(directory=ROOT / "dist/assets"), name="assets")

        @app.get("/{path:path}")
        def spa(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "Endpoint not found.")
            return FileResponse(ROOT / "dist/index.html")

    return app


app = create_app()
