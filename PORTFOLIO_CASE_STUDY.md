# Portfolio case study — QA Sentinel

## Problem

A testing portfolio needs more than screenshots of green checks. A reviewer should see what behavior is protected, why the tests are placed at particular layers, how failures are diagnosed, and whether the suite detects actual regressions.

## Solution and workflow

QA Sentinel pairs a small release task workbench with a reproducible automation system. A visitor opens a private fictional demo, inspects work, creates an item, changes its status, filters the list and checks activity. A registered user gets an empty private workspace. Account deletion removes associated data. The system is small enough to understand while containing realistic risks: session revocation, object ownership, concurrency, input boundaries and mobile forms.

## Architecture

React/TypeScript handles presentation and client feedback. FastAPI validates requests and delegates task operations to an owner-scoped repository. SQLite transactions, foreign keys and revision counters protect integrity. Passwords use salted scrypt; session cookies contain opaque tokens whose digests are stored server-side. No frontend secret or shared demo account is needed.

pytest tests domain and API/database behavior in isolated databases. Playwright verifies HTTP contracts and complete browser journeys at desktop, tablet and mobile sizes. Vitest guards browser-side validation. A separate mutation script copies the backend, introduces one documented bug and evaluates a targeted test. CI builds the app and executes the suites with zero retries, retaining evidence.

## Technical challenges and decisions

**Isolation versus realism:** tests exercise real storage and HTTP rather than replacing the whole backend with mocks. Fresh account fixtures prevent ordering dependencies; the browser test server owns a temporary SQLite directory and cannot reset ordinary local data.

**Lost updates:** two editors can hold an old task version. Atomic revision checks return a meaningful conflict instead of silently overwriting another change. Tests cover sequential stale writes, simultaneous writers and the UI conflict message.

**Useful failure evidence:** a failed mutation must be an assertion failure, not an import or fixture error. The runner verifies a green baseline, a single executed test, no setup errors, and unchanged production source. Four selected detected bugs demonstrate fault sensitivity; they do not prove universal coverage.

**Mobile defect diagnosis:** the first populated mobile editor failed on normal clicks. Geometry inspection traced it to a hidden table heading extending the layout viewport. Correcting the scroll container fixed the actual page; forcing the click would only hide the bug. A regression assertion now covers the populated page width.

**Date validation:** an impossible month revealed a potential exception in client parsing. A finite-timestamp guard and boundary cases ensure the user gets validation feedback. API validation remains independent.

## Testing approach

Risk-based priorities put private-data access and session revocation first, followed by CRUD integrity, concurrency and mobile completion. The suite combines boundary analysis, negative payloads, lifecycle transitions, API contracts, controlled 503 recovery and deliberate mutations. Detailed traceability is in TEST_CASES.md. Machine-generated reports record executed checks; the test plan distinguishes supported emulation from untested real devices and browsers.

## Deployment and privacy

The public frontend uses a same-origin API proxy to a free Python host. Each recruiter demo gets an isolated account with a 24-hour lifetime. Hosting can reset SQLite data on restart or deployment, so the public app explicitly asks for fictional data. Local storage or a Docker volume persists. Free hosting demonstrates deployment mechanics, not business-grade durability. No external database credential is necessary.

## Learning and interview preparation

This project was implemented with substantial AI assistance. The code, decisions and reports are available to study and reproduce; this document does not claim the portfolio owner has already mastered them. Before an interview, run the suites, explain why authorization belongs on the server, reproduce one mutant, inspect a Playwright trace, explain 409 conflicts and write an additional boundary test independently.

The engineering lessons illustrated here are that a passing happy path is insufficient, isolation reduces flaky behavior, test setup errors are not detected product defects, and responsive correctness requires exercising real populated states. Clear limits are more credible than claiming an application is bug-free.

## Possible future development

Firefox/WebKit and real-device checks, automated accessibility, broader mutation/property-based testing, measured coverage gates, controlled load tests, durable storage/backups, monitoring, and recovery workflows. Add features only when accompanied by risks, acceptance criteria and suitable verification.
