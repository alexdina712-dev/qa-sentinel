# Deployment

## Local production build

Activate Python environment and install requirements as in README. Run `pnpm build`, then `python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8082`. Set `APP_ORIGIN=http://127.0.0.1:8082` for this single-origin mode. FastAPI serves the built SPA when `dist/` exists. Normal development uses Vite 5178 and API 8006.

## Docker

`docker compose up --build -d` serves `http://localhost:8082`. `docker compose down` stops it without deleting the named database volume. Removing the volume destroys local accounts and tasks. The image runs as a non-root user. Docker configuration is provided, but Docker execution is not verified on the author's Windows machine because Docker is unavailable. For a real HTTPS deployment set `ENVIRONMENT=production`, exact HTTPS `APP_ORIGIN`, and provide durable storage.

## Free public portfolio deployment

1. Publish the source to your own GitHub repository. Wait for the verification workflow to pass.
2. Render: create a free Python web service, repository root, build `pip install -r backend/requirements.txt`, start `python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT --workers 1 --limit-concurrency 20 --no-access-log`. Health path `/api/health`. Use Python 3.12. Set `ENVIRONMENT=production`, `DATABASE_PATH=/tmp/qa-sentinel.db`, `APP_ORIGIN` to the exact canonical Vercel HTTPS domain. Do not add a paid disk for the portfolio demo.
3. Vercel: frontend framework Vite, build `pnpm build`, output `dist`. `vercel.json` proxies `/api/:path*` to this Render service before the SPA fallback. Never put secrets in Vite-prefixed variables. API authentication remains in HttpOnly cookies on the frontend origin.
4. Verify the canonical domain is public, not protected by preview authentication. Run the explicit public smoke command from README. The first request can be slow while Render wakes; the UI surfaces retryable failures.
5. Keep CI as a gate. Render automatic deployment waits for checks; verify its live commit after changes. Re-run smoke after a release affecting the app or deployment configuration.

### Operational limits

The free service's SQLite is **ephemeral**: resets may occur on deploy/restart. Registered accounts are not a durable cloud service. Each demo is owner-isolated and expires after 24 hours; expired data is cleaned during startup/account creation. Local SQLite is persistent. Do not enter sensitive data into the hosted demo.

Cookies: Secure in production, HttpOnly, SameSite=Lax, opaque random token. Server stores only its digest. Writes require matching Origin. Requests are bounded; rate counters are process-local. Use one API worker; multiple workers or instances require distributed counters and a suitable database design. Free host sleeping, a process-local limiter and a single SQLite node are documented tradeoffs.

For a commercial deployment add durable storage/backups, tested restores, monitoring, security review, recovery/verification email, privacy terms and appropriate capacity controls. This repository does not claim those are already provided.
