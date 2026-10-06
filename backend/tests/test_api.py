import time
import uuid
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi.testclient import TestClient
from app.auth import COOKIE, digest_token
from app.config import Settings
from app.db import transaction
from app.main import create_app


def test_valid_login_and_generic_wrong_credentials(owner, credentials):
    owner.post("/api/auth/logout")
    assert owner.post("/api/auth/login", json={**credentials, "name": "extra"}).status_code == 422
    payload = {k: credentials[k] for k in ["email", "password"]}
    bad = owner.post("/api/auth/login", json={**payload, "password": "wrong"})
    unknown = owner.post("/api/auth/login", json={**payload, "email": "unknown@example.com"})
    assert bad.status_code == unknown.status_code == 401 and bad.json() == unknown.json()
    assert owner.post("/api/auth/login", json=payload).status_code == 200
    assert owner.get("/api/auth/me").json()["email"] == credentials["email"]


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "broken", "password": "longpassword"},
        {"email": "valid@example.com", "password": ""},
        {"email": None, "password": "longpassword"},
    ],
)
def test_invalid_login_payloads(client, payload):
    assert client.post("/api/auth/login", json=payload).status_code == 422


def test_duplicate_registration_is_case_insensitive(owner, credentials):
    assert (
        owner.post(
            "/api/auth/register", json={**credentials, "email": credentials["email"].upper()}
        ).status_code
        == 409
    )


def test_password_hash_and_token_digest_are_not_exposed(owner, settings):
    data = owner.get("/api/auth/me").json()
    token = owner.cookies.get(COOKIE)
    with transaction(settings.database) as conn:
        user = conn.execute("SELECT * FROM users WHERE id=?", (data["id"],)).fetchone()
        assert "password_hash" not in data and ":" in user["password_hash"]
        assert conn.execute("SELECT digest FROM sessions").fetchone()[0] == digest_token(token)


def test_logout_revokes_captured_session(owner):
    token = owner.cookies.get(COOKIE)
    assert owner.post("/api/auth/logout").status_code == 204
    assert owner.get("/api/auth/me", headers={"Cookie": COOKIE + "=" + token}).status_code == 401


def test_expired_session_rejected(owner, settings):
    with transaction(settings.database, True) as conn:
        conn.execute("UPDATE sessions SET expires_at=?", (int(time.time()) - 1,))
    assert owner.get("/api/tasks").status_code == 401


@pytest.mark.parametrize("endpoint", ["/api/tasks", "/api/dashboard", "/api/auth/me"])
def test_unauthorized_access(client, endpoint):
    assert client.get(endpoint).status_code == 401


def test_cross_user_reads_are_hidden(owner, task, settings):
    with TestClient(create_app(settings)) as outsider:
        assert outsider.post("/api/auth/demo").status_code == 201
        assert outsider.get("/api/tasks/" + task["id"]).status_code == 404
        assert task["id"] not in [t["id"] for t in outsider.get("/api/tasks").json()["items"]]
        assert (
            outsider.put(
                "/api/tasks/" + task["id"], json={"title": "Attempted overwrite", "revision": 1}
            ).status_code
            == 404
        )
        assert outsider.delete("/api/tasks/" + task["id"] + "?revision=1").status_code == 404
    assert owner.get("/api/tasks/" + task["id"]).json()["title"] == task["title"]


def test_whitespace_title_rejected(owner):
    assert owner.post("/api/tasks", json={"title": "   "}).status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "ab"},
        {"title": "x" * 121},
        {"title": "Valid title", "status": "SHIPPED"},
        {"title": "Valid title", "priority": "URGENT"},
        {"title": "Valid title", "due_date": "2026-02-30"},
        {"title": "Valid title", "user_id": "other"},
        {"title": "Valid title", "description": "x" * 2001},
    ],
)
def test_validation_failures_leave_database_unchanged(owner, payload):
    assert owner.post("/api/tasks", json=payload).status_code == 422
    assert owner.get("/api/tasks").json()["total"] == 0


def test_full_task_lifecycle(owner, task):
    endpoint = "/api/tasks/" + task["id"]
    updated = owner.put(
        endpoint, json={"title": "Completed review", "status": "DONE", "revision": 1}
    ).json()
    assert updated["revision"] == 2 and updated["status"] == "DONE"
    assert owner.delete(endpoint + "?revision=2").status_code == 204
    assert owner.get(endpoint).status_code == 404
    assert {a["action"] for a in owner.get("/api/dashboard").json()["activity"]} == {
        "created",
        "completed",
        "deleted",
    }


def test_stale_update_is_rejected(owner, task):
    endpoint = "/api/tasks/" + task["id"]
    assert owner.put(endpoint, json={"title": "New version", "revision": 1}).status_code == 200
    assert owner.put(endpoint, json={"title": "Stale overwrite", "revision": 1}).status_code == 409
    assert owner.get(endpoint).json()["title"] == "New version"
    assert owner.delete(endpoint + "?revision=1").status_code == 409


def test_concurrent_updates_have_one_winner(owner, task, settings):
    token = owner.cookies.get(COOKIE)

    def update(title):
        with TestClient(create_app(settings)) as client:
            return client.put(
                "/api/tasks/" + task["id"],
                headers={"Cookie": COOKIE + "=" + token},
                json={"title": title, "revision": 1},
            ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(update, ["Concurrent first", "Concurrent second"])) == [200, 409]


def test_search_is_literal_and_pagination_stable(owner):
    for title in ["100% release review", "Ordinary task", "Third item"]:
        owner.post("/api/tasks", json={"title": title})
    assert owner.get("/api/tasks", params={"q": "%"}).json()["total"] == 1
    assert owner.get("/api/tasks", params={"q": "' OR 1=1 --"}).json()["total"] == 0
    first = owner.get("/api/tasks?page_size=2").json()
    second = owner.get("/api/tasks?page_size=2&page=2").json()
    assert first["total"] == 3 and len(second["items"]) == 1
    assert not set(t["id"] for t in first["items"]) & set(t["id"] for t in second["items"])


@pytest.mark.parametrize("query", ["page=0", "page_size=51", "status=UNKNOWN", "priority=BAD"])
def test_invalid_query(owner, query):
    assert owner.get("/api/tasks?" + query).status_code == 422


def test_nonexistent_resource_and_malformed_id(owner):
    assert owner.get("/api/tasks/" + str(uuid.uuid4())).status_code == 404
    assert owner.get("/api/tasks/not-an-id").status_code == 422


def test_dashboard_excludes_completed_overdue(owner):
    for status in ["TODO", "DONE"]:
        owner.post(
            "/api/tasks",
            json={"title": "Historical task", "status": status, "due_date": "2000-01-01"},
        )
    data = owner.get("/api/dashboard").json()
    assert data["overdue"] == 1 and data["total"] == 2 and data["counts"]["DONE"] == 1


def test_account_deletion_cascades_and_requires_password(owner, task, credentials, settings):
    uid = owner.get("/api/auth/me").json()["id"]
    assert owner.request("DELETE", "/api/account", json={"password": "wrong"}).status_code == 401
    assert (
        owner.request(
            "DELETE", "/api/account", json={"password": credentials["password"]}
        ).status_code
        == 204
    )
    assert owner.get("/api/auth/me").status_code == 401
    with transaction(settings.database) as conn:
        for table in ["tasks", "sessions", "activity"]:
            assert (
                conn.execute(
                    "SELECT COUNT(*) FROM " + table + " WHERE user_id=?", (uid,)
                ).fetchone()[0]
                == 0
            )


def test_demo_is_private_and_can_be_deleted(client, settings):
    assert client.post("/api/auth/demo").status_code == 201
    assert client.get("/api/tasks").json()["total"] == 8
    with TestClient(create_app(settings)) as second:
        second.post("/api/auth/demo")
        assert (
            second.get("/api/tasks").json()["items"][0]["id"]
            != client.get("/api/tasks").json()["items"][0]["id"]
        )
    assert (
        client.request("DELETE", "/api/account", json={"password": "DELETE DEMO"}).status_code
        == 204
    )


def test_request_limits_and_error_privacy(client):
    assert (
        client.post(
            "/api/auth/login", content="{", headers={"Content-Type": "application/json"}
        ).status_code
        == 422
    )
    response = client.post("/api/auth/login", json={"secret": "x" * 33000})
    assert response.status_code == 413 and response.headers["cache-control"] == "no-store"
    assert "xxx" not in response.text
    assert (
        client.post("/api/auth/demo", headers={"Origin": "https://untrusted.example"}).status_code
        == 403
    )


def test_production_origin_and_cookie(settings):
    prod = Settings(database=settings.database, production=True, origin="https://sentinel.example")
    with TestClient(create_app(prod), base_url="https://sentinel.example") as client:
        assert client.post("/api/auth/demo").status_code == 403
        response = client.post("/api/auth/demo", headers={"Origin": prod.origin})
        assert response.status_code == 201
        cookie = response.headers["set-cookie"].lower()
        assert all(flag in cookie for flag in ["httponly", "secure", "samesite=lax"])
        assert client.get("/api/auth/me").status_code == 200


def test_auth_rate_limit(settings):
    limited = Settings(database=settings.database, auth_limit=2)
    with TestClient(create_app(limited)) as client:
        assert client.post("/api/auth/demo").status_code == 201
        assert client.post("/api/auth/demo").status_code == 201
        assert client.post("/api/auth/demo").status_code == 429


def test_workspace_capacity(owner, settings):
    uid = owner.get("/api/auth/me").json()["id"]
    with transaction(settings.database, True) as conn:
        conn.executemany(
            "INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?)",
            [
                (str(uuid.uuid4()), uid, "Capacity fixture", "", "TODO", "LOW", None, 1, 0, 0)
                for _ in range(200)
            ],
        )
    assert owner.post("/api/tasks", json={"title": "Over capacity"}).status_code == 409
