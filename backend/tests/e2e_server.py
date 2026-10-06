"""Dedicated test server; no production bypass switches or reset endpoints."""

from pathlib import Path
from tempfile import TemporaryDirectory
from app.config import Settings
from app.main import create_app

workspace = TemporaryDirectory(prefix="qa-sentinel-e2e-")
app = create_app(
    Settings(
        database=str(Path(workspace.name) / "test.db"),
        origin="http://127.0.0.1:5188",
        auth_limit=1000,
    )
)
