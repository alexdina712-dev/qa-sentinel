# Test plan — QA Sentinel

## Objective and system under test

Verify that a small task workbench protects private data and supports reliable account and work-item workflows. Demonstrate practical QA reasoning, readable automation, reproducible defects, and CI evidence. Tests target the checked-out app, not third-party websites.

## Risk priorities

| Priority | Risk | Required evidence |
| --- | --- | --- |
| P0 | Account A reads/writes B's tasks | Owner/outsider API scenarios; deliberate authorization mutation |
| P0 | Logged-out session remains usable | Captured-cookie replay returns 401; logout mutation |
| P1 | Concurrent edit silently loses data | 409 with unchanged latest content; concurrent writers; stale UI dialog |
| P1 | CRUD, deletion or validation corrupts state | Full lifecycle, invalid inputs, cascade checks, transaction assertions |
| P1 | Small-screen users cannot finish a task | Touch-emulated CRUD and populated-table overflow assertion |
| P2 | Search or summaries mislead | Literal search, combined filters, paging, overdue/completed cases |
| P2 | Service failures leave a dead screen | Controlled 503, visible explanation, working retry |

## Scope and environments

Python 3.12 / Node 22 or 24. pytest gets a new SQLite database per test; Playwright owns separate API/web processes on 8007/5188. Accounts have random fictional emails under example.com. Seeds contain eight fixed work-item concepts with dates relative to the current UTC day. Test clocks are explicit where boundaries are asserted. No real CVs, clients, passwords or production datasets belong in fixtures.

UI coverage: Chromium desktop (1280×720), iPad Mini emulation, iPhone 13 emulation. Exact device descriptors are in Playwright config. These are viewport/touch checks, not evidence of Safari or real iOS compatibility. Deployment smoke uses desktop/mobile against an explicitly supplied HTTPS URL with one worker and its own disposable accounts.

## Techniques

Boundary value analysis (title length, password UTF-8 length, date range), equivalence partitions (valid/invalid statuses and emails), state transitions (TODO → DONE; session login → logout), decision combinations (owner vs outsider vs anonymous), negative payloads, stale revisions, concurrent writes and controlled fault injection. API schema failures must leave stored data unchanged. Application errors and test setup failures must be distinguished.

Most behavior lives in fast API/database tests. Browser tests cover important integrations and presentation. Fixtures establish accounts through the API except where registration itself is under test; assertions stay on observable behavior. Test IDs connect suites to TEST_CASES.md. No arbitrary sleeps, shared test accounts, order dependencies or retries are allowed.

## Entry / exit criteria

Entry: dependencies installed from locks, ports free, fresh test database, no pending environment changes.

Exit: lint and production build pass; all pytest, Vitest and Playwright tests pass; selected stability repetition has no failures with retries disabled; four mutation baselines pass and four mutants fail assertions; actual screenshots inspected; public smoke passes after deployment; limitations documented. Counts are recorded from generated reports, not hard-coded as a substitute for execution.

A release must not be called green if tests fail to start, time out, are unexpectedly skipped, or lack report evidence. Investigation starts with the first failed assertion, HTTP result, screenshot and trace. Fix product defects or incorrect tests, explain the cause, then rerun affected checks and the full suite after final changes.

## Deliverables and ownership

README, this plan, traceability cases, bug-report examples, machine reports, consolidated HTML, real screenshots and a reproducible mutation script. CI retains detailed artifacts for 14 days; committed evidence is a dated snapshot. Reviewers can regenerate everything. No assertion that these checks guarantee a defect-free product.

## Deliberate exclusions / next steps

No payment/email integrations, uploads, multi-tenant roles, performance SLO, formal accessibility certification, penetration test, disaster recovery, distributed rate limiting or real-device coverage. Future work should add cross-browser/accessibility gates and load tests with measurable acceptance criteria. Free hosting is disposable and not a durability test environment.
