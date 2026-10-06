# Bug report examples

BUG-001–004 are **intentionally introduced defects in disposable local source copies**. They are not claims of vulnerabilities in the deployed release. Run `python scripts/mutation_demo.py` to reproduce all four. The runner first verifies a green baseline, changes one statement, expects one assertion failure (not a setup error), and deletes the copy. Production code is unchanged. Actual assertion summaries are in `docs/evidence/mutation-results.json`.

## BUG-001 — Another account can read a private work item

Severity: critical; priority: P0. Environment: isolated FastAPI/SQLite copy. Preconditions: two authenticated accounts; task owned by account A.

Steps: create A's task; sign in as B; GET `/api/tasks/{A-task-id}`.

Expected: 404 without task data. Actual in mutant: 200 with A's task. Injection: replace owner predicate in `get_task` with a trivially true bound expression. Root cause: resource identity checked without ownership. Resolution: preserve `id=? AND user_id=?` on reads and all mutations. Regression: `test_cross_user_reads_are_hidden`. Evidence: baseline passes; mutated response 200 fails expected 404. Impact: private content disclosure; access checks must not depend on UI visibility.

## BUG-002 — Stale update overwrites newer work

Severity: high; priority: P1. Preconditions: two copies of the same revision-1 task.

Steps: save newer title using revision 1; submit a second title using the original revision 1.

Expected: 409 and first title preserved. Actual in mutant: second update returns 200 and overwrites content. Injection: remove the revision equality predicate from update SQL while retaining parameter count. Root cause: missing atomic compare-and-update guard. Resolution: include current revision in WHERE and check affected rows inside a transaction. Regression: `test_stale_update_is_rejected`; related real-browser stale-dialog case and concurrent-writer test. Evidence: actual 200 vs expected 409.

## BUG-003 — Whitespace-only work item accepted

Severity: medium; priority: P1. Preconditions: authenticated account.

Steps: POST `/api/tasks` with `{"title":"   "}`.

Expected: 422 and unchanged task count. Actual in mutant: 201 creates an unusable blank title. Injection: bypass pre-validation trimming. Root cause: minimum length measured before normalization. Resolution: trim first, then enforce 3–120 characters. Regression: `test_whitespace_title_rejected`. Evidence: actual 201 vs expected 422. Browser validation alone would not protect direct API callers.

## BUG-004 — Logout clears the browser but not the server session

Severity: high; priority: P0. Preconditions: authenticated session token captured within the isolated fixture.

Steps: POST logout; replay captured cookie on GET `/api/auth/me`.

Expected: 401. Actual in mutant: 200 remains authenticated. Injection: replace session DELETE with a no-op SELECT. Root cause: server-side revocation missing despite cookie clearing. Resolution: delete the stored digest and clear cookie. Regression: `test_logout_revokes_captured_session`. Evidence contains only status assertion text, never the captured token. This illustrates why a UI redirect is insufficient proof of logout.

## Real development finding — Mobile editor could not save reliably

Severity: high for mobile users; status: fixed. Found by UI-CRUD-01 and UI-EDGE-01 on Chromium iPhone emulation. A visually hidden table heading used absolute positioning outside a containing block; the populated table extended the mobile layout viewport, shifting dialog hit targets. Save clicks were intercepted by unrelated form elements.

Fix: give the table scroll container a positioning context, constrain mobile dialog width/height, and keep mobile inputs at readable 16px. Verification: rerun both failing workflows and add a document-width assertion to populated CRUD. Do not use forced clicks to conceal the defect. Retained tests are the regression evidence; transient failure traces are not published because session state may be present.

## Real development finding — Impossible dates threw a client exception

Severity: medium; status: fixed. Code review found `toISOString()` was called before testing whether date parsing succeeded. A value such as `2026-99-01` could throw instead of returning a validation error.

Fix: check finite timestamp before formatting. Verification: parameterized Vitest cases for impossible month/day/zero date plus the existing calendar-day case. The server independently rejects these values.

## Test-maintenance finding — Navigation count changed accessible name

The Work items link includes its live count. An exact text locator for `Work items` timed out after navigation rendered. The fixture now matches the accessible link name with an optional numeric suffix. This was an automation assumption error, not an application authorization bug. Scope remains the main navigation, preventing ambiguous global text matches.
