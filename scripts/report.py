"""Build an honest, readable report from actual test runner output."""

from datetime import datetime, timezone
import html
import json
import os
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"


def summarize():
    rows = []
    path = REPORTS / "pytest.xml"
    if path.exists():
        cases = ET.parse(path).findall(".//testcase")
        failed = sum(c.find("failure") is not None or c.find("error") is not None for c in cases)
        skipped = sum(c.find("skipped") is not None for c in cases)
        rows.append(("pytest: domain + API", len(cases) - failed - skipped, failed, skipped))
    path = REPORTS / "vitest.json"
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        rows.append(
            (
                "Vitest: client validation",
                data["numPassedTests"],
                data["numFailedTests"],
                data["numPendingTests"],
            )
        )
    for filename, label in [
        ("playwright.json", "Playwright: isolated UI + HTTP"),
        ("public.json", "Playwright: deployment smoke"),
    ]:
        path = REPORTS / filename
        if path.exists():
            stats = json.loads(path.read_text(encoding="utf-8"))["stats"]
            rows.append(
                (label, stats["expected"], stats["unexpected"] + stats["flaky"], stats["skipped"])
            )
    return rows


if __name__ == "__main__":
    REPORTS.mkdir(exist_ok=True)
    rows = summarize()
    mutations = REPORTS / "mutations.json"
    mutation_text = "Not executed in this report."
    if mutations.exists():
        data = json.loads(mutations.read_text(encoding="utf-8"))
        detected = sum(
            r["mutant"] == "detected" and r["baseline"] == "passed" for r in data["results"]
        )
        mutation_text = f"{detected}/{len(data['results'])} selected bugs detected after passing baselines. Not a whole-project mutation score."
    timestamp = datetime.now(timezone.utc).isoformat()
    table = "".join(
        f"<tr><td>{html.escape(name)}</td><td>{passed}</td><td>{failed}</td><td>{skipped}</td></tr>"
        for name, passed, failed, skipped in rows
    )
    content = f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>QA Sentinel — verification report</title><style>body{{font:16px/1.6 system-ui;background:#f4f7f5;color:#193b32;max-width:950px;margin:50px auto;padding:24px}}h1{{font-size:38px}}table{{border-collapse:collapse;width:100%;background:white}}td,th{{padding:16px;text-align:left;border-bottom:1px solid #dbe5df}}small{{color:#536c60}}section{{background:#e0eee4;padding:24px;margin-top:24px}}</style><small>QA SENTINEL / ENGINEERING EVIDENCE</small><h1>Verification report</h1><p>Generated {html.escape(timestamp)} from available runner outputs. Missing suites are not counted as passing. Flaky executions count as failures.</p><table><tr><th>Suite</th><th>Passed</th><th>Failed</th><th>Skipped</th></tr>{table}</table><section><h2>Fault detection</h2><p>{html.escape(mutation_text)}</p></section><p>UI device executions and parameterized cases are separate runs, not unique business requirements. These results do not establish production durability, penetration-test coverage or real-device compatibility.</p></html>"""
    (REPORTS / "verification.html").write_text(content, encoding="utf-8")
    snapshot = {
        "generated_at": timestamp,
        "suites": [dict(zip(["suite", "passed", "failed", "skipped"], row)) for row in rows],
        "mutations": mutation_text,
    }
    (REPORTS / "summary.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    lines = (
        [
            "## QA Sentinel verification",
            "| Suite | Passed | Failed | Skipped |",
            "|---|---:|---:|---:|",
        ]
        + [
            f"| {name} | {passed} | {failed} | {skipped} |"
            for name, passed, failed, skipped in rows
        ]
        + ["", mutation_text]
    )
    print("\n".join(lines))
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
            output.write("\n".join(lines) + "\n")
