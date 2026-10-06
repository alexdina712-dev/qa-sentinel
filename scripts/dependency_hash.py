"""Fingerprint requirements consistently across PowerShell versions."""

import hashlib
from pathlib import Path

root = Path(__file__).resolve().parents[1]
print(
    hashlib.sha256(
        (root / "backend/requirements.txt").read_bytes()
        + (root / "backend/requirements-dev.txt").read_bytes()
    ).hexdigest()
)
