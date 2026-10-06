import hashlib
import hmac
import secrets
import time
from fastapi import HTTPException

COOKIE = "sentinel_session"


def hash_password(password):
    salt = secrets.token_hex(16)
    derived = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return salt + ":" + derived.hex()


def verify_password(password, encoded):
    if len(password.encode()) > 256:
        return False
    salt, expected = encoded.split(":")
    actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return hmac.compare_digest(actual.hex(), expected)


DUMMY_HASH = hash_password("a fictional timing placeholder")


def digest_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def current_user(conn, token):
    if not token or len(token) != 64:
        raise HTTPException(401, "Sign in to continue.")
    now = int(time.time())
    row = conn.execute(
        "SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id "
        "WHERE s.digest=? AND s.expires_at>? AND (u.expires_at IS NULL OR u.expires_at>?)",
        (digest_token(token), now, now),
    ).fetchone()
    if not row:
        raise HTTPException(401, "Your session expired. Sign in again.")
    return dict(row)


def public_user(row):
    return {key: row[key] for key in ["id", "name", "email", "demo", "expires_at"]}


def issue_session(conn, user_id, response, settings):
    token = secrets.token_hex(32)
    conn.execute(
        "INSERT INTO sessions VALUES(?,?,?)",
        (digest_token(token), user_id, int(time.time()) + settings.session_seconds),
    )
    response.set_cookie(
        COOKIE,
        token,
        max_age=settings.session_seconds,
        httponly=True,
        secure=settings.production,
        samesite="lax",
        path="/",
    )


def revoke_session(conn, token):
    digest = digest_token(token or "")
    conn.execute("DELETE FROM sessions WHERE digest=?", (digest,))  # mutation target: logout
