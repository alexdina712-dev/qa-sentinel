"""Prove four selected regressions are detected in disposable source copies."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    (
        "BUG-001",
        "Cross-account task disclosure",
        "repository.py",
        "SELECT * FROM tasks WHERE id=? AND user_id=?",
        "SELECT * FROM tasks WHERE id=? AND (? IS NOT NULL)",
        "test_cross_user_reads_are_hidden",
    ),
    (
        "BUG-002",
        "Stale edit overwrites newer work",
        "repository.py",
        "AND revision=?",
        "AND (? >= 0)",
        "test_stale_update_is_rejected",
    ),
    (
        "BUG-003",
        "Whitespace-only title accepted",
        "schemas.py",
        "return value.strip()  # mutation target: whitespace validation",
        "return value  # mutation target: whitespace validation",
        "test_whitespace_title_rejected",
    ),
    (
        "BUG-004",
        "Captured session survives logout",
        "auth.py",
        "DELETE FROM sessions WHERE digest=?",
        "SELECT ?",
        "test_logout_revokes_captured_session",
    ),
]


def fingerprint():
    return {
        str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in (ROOT / "backend").rglob("*.py")
    }


def run_case(directory, test, report):
    env = {**os.environ, "PYTHONPATH": str(directory / "backend")}
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            f"backend/tests/test_api.py::{test}",
            "-q",
            f"--junitxml={report}",
            f"--basetemp={report.with_suffix('.tmp')}",
        ],
        cwd=directory,
        env=env,
        capture_output=True,
        text=True,
        timeout=90,
    )
    if result.returncode not in (0, 1) or "ERROR" in result.stdout:
        print(result.stdout[-3000:], result.stderr[-1000:])
    if not report.exists():
        raise RuntimeError(f"No test report for {test}; runner failed (exit {result.returncode}).")
    cases = ET.parse(report).findall(".//testcase")
    failures = [c.find("failure") for c in cases if c.find("failure") is not None]
    errors = sum(c.find("error") is not None for c in cases)
    return result.returncode, len(cases), failures, errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="reports/mutations.json")
    args = parser.parse_args()
    original = fingerprint()
    evidence = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "Four deliberately selected regressions; not a whole-codebase mutation score.",
        "results": [],
    }
    with tempfile.TemporaryDirectory(prefix="qa-sentinel-mutants-") as tmp:
        temp = Path(tmp)
        baseline = temp / "baseline"
        shutil.copytree(
            ROOT / "backend", baseline / "backend", ignore=shutil.ignore_patterns("__pycache__")
        )
        shutil.copy2(ROOT / "pyproject.toml", baseline / "pyproject.toml")
        for bug, title, module, old, new, test in CASES:
            code, count, failures, errors = run_case(baseline, test, temp / f"{bug}-baseline.xml")
            if code != 0 or count != 1 or failures or errors:
                raise RuntimeError(
                    f"{bug}: baseline must pass before mutation. Exit={code}, cases={count}, failures={[f.get('message') for f in failures]}, errors={errors}"
                )
            mutant = temp / bug
            shutil.copytree(
                baseline, mutant, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache")
            )
            source = mutant / "backend" / "app" / module
            content = source.read_text(encoding="utf-8")
            if old not in content:
                raise RuntimeError(f"{bug}: mutation target no longer exists.")
            source.write_text(content.replace(old, new, 1), encoding="utf-8")
            code, count, failures, errors = run_case(mutant, test, temp / f"{bug}-mutant.xml")
            killed = code == 1 and count == 1 and len(failures) == 1 and errors == 0
            assertion = (
                failures[0].get("message", "").splitlines()[0]
                if failures
                else "No assertion failure"
            )
            evidence["results"].append(
                {
                    "id": bug,
                    "title": title,
                    "test": test,
                    "baseline": "passed",
                    "mutant": "detected" if killed else "not detected",
                    "assertion": assertion,
                }
            )
            print(
                f"{bug}: baseline passed; mutant {'detected' if killed else 'NOT DETECTED'}",
                flush=True,
            )
    if fingerprint() != original:
        raise RuntimeError("Production source changed during mutation demonstration.")
    evidence["production_source_unchanged"] = True
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    if any(r["mutant"] != "detected" for r in evidence["results"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
