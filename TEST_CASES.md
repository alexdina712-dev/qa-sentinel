# Test cases and traceability

Automated test titles/functions are the source of execution truth. Parameterized inputs produce multiple executions of a case. UI repetitions across devices are reported separately.

| ID / pytest function | Preconditions and action | Expected outcome | Layer |
| --- | --- | --- | --- |
| UI-AUTH-01 / API-AUTH-02 | Existing private account; wrong password, then correct password, reload, logout | Generic 401/error for wrong password; authenticated page persists on reload; logout protects page | Browser + HTTP |
| UI-AUTH-02 | Register; malformed then valid email | Native invalid-email feedback; valid registration opens empty workspace | Browser |
| UI-AUTH-03 | Choose demo and delete it | Eight fictional private tasks; explicit confirmation destroys workspace | Browser |
| API-AUTH-01 / test_unauthorized_access | Anonymous request to protected routes | 401, no private content | HTTP + integration |
| test_expired_session_rejected | Expire stored session | 401 | Integration |
| test_password_hash_and_token_digest_are_not_exposed | Register and inspect DB/response | Salted hash and token digest at rest; neither returned | Integration |
| test_duplicate_registration_is_case_insensitive | Re-register case variant email | 409 without duplicate account | Integration |
| UI-CRUD-01 / API-CRUD-01 | Create, edit, complete, cancel deletion, confirm deletion | Correct fields/activity; cancellation retains item; confirmed deletion removes it | Browser + HTTP |
| API-NEG-01 / test_validation_failures_leave_database_unchanged | Blank/overlong title, unknown status, impossible date, extra owner | 422 and no unintended write | HTTP + integration |
| UI-NEG-01 | Whitespace title; escape editor; submit literal markup | Helpful error, restored keyboard focus, markup rendered as text | Browser |
| API-NEG-02 | Invalid query/UUID, absent resource, malformed or oversized JSON | 422/404/413 as applicable | HTTP |
| UI-EDGE-01 / API-EDGE-01 / test_stale_update_is_rejected | Two readers at revision 1; one saves then other writes | 409 for stale update/delete; latest content remains | Browser + HTTP + integration |
| test_concurrent_updates_have_one_winner | Two simultaneous revision-1 writes | One 200, one 409 | Integration |
| API-SEC-01 / test_cross_user_reads_are_hidden | User B attempts A's GET/PUT/DELETE | 404 for all; A's item unchanged | HTTP + integration |
| API-SEC-02 / test_logout_revokes_captured_session | Logout then replay old cookie | 401 despite retaining old token | HTTP + integration |
| test_production_origin_and_cookie | Production config, wrong/missing Origin | Writes blocked; successful session cookie Secure/HttpOnly/SameSite | Integration |
| test_auth_rate_limit | Exceed configured login budget | 429 | Integration |
| test_workspace_capacity | Fill account to task cap | Further create rejected, existing data intact | Integration |
| UI-SEARCH-01 / test_search_is_literal_and_pagination_stable | Two differently tagged tasks, literal %, query, status, priority, reset | Correct visible result set, reset restores items; paging stable | Browser + integration |
| UI-RESILIENCE-01 | Mock task request 503, remove mock, retry; navigate at device width | Error displayed; retry recovers; no outer-page horizontal overflow | Browser |
| UI-PRIVACY-01 / test_account_deletion_cascades_and_requires_password | Wrong confirmation then valid deletion | First leaves data intact; second deletes user/tasks/sessions/activity | Browser + integration |
| test_dashboard_excludes_completed_overdue | Past-due open and complete tasks | Only open work contributes to overdue count | Integration |
| test_demo_is_private_and_can_be_deleted | Create two demo sessions | Separate owners, deletable, no shared session | Integration |
| Domain + client validation | Boundary titles, Unicode passwords, invalid calendar dates | Valid boundaries accepted; invalid values rejected without exceptions | pytest + Vitest |

The mutation runner maps BUG-001 through BUG-004 to specific pytest functions. See BUG_REPORT_EXAMPLES.md. Responsive CRUD additionally checks the populated table does not extend document width; this guards a real defect found during development.
