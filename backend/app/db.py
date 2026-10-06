"""SQLite connections are short-lived; writes use explicit serialized transactions."""

from contextlib import contextmanager, closing
from pathlib import Path
import sqlite3
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS users(
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
 digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS tasks(
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('TODO','IN_PROGRESS','BLOCKED','DONE')),
 priority TEXT NOT NULL CHECK(priority IN ('LOW','MEDIUM','HIGH')),
 due_date TEXT, revision INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS task_owner ON tasks(user_id,status,created_at);
CREATE TABLE IF NOT EXISTS activity(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 action TEXT NOT NULL, subject TEXT NOT NULL, created_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO schema_migrations VALUES(1);
PRAGMA user_version = 1;
"""


def connect(database):
    conn = sqlite3.connect(database, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def initialize(database):
    Path(database).resolve().parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(database)) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(SCHEMA)


@contextmanager
def transaction(database, write=False):
    conn = connect(database)
    try:
        conn.execute("BEGIN IMMEDIATE" if write else "BEGIN")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def cleanup(conn):
    now = int(time.time())
    conn.execute("DELETE FROM sessions WHERE expires_at<=?", (now,))
    conn.execute("DELETE FROM users WHERE expires_at IS NOT NULL AND expires_at<=?", (now,))
