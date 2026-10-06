"""Origin verification, bounded bodies and bounded in-process rate accounting."""

import time
from collections import defaultdict, deque
from threading import Lock
from starlette.responses import JSONResponse


class SecurityMiddleware:
    def __init__(self, app, settings):
        self.app, self.settings = app, settings
        self.hits = defaultdict(deque)
        self.lock = Lock()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def secure_send(message):
            if message["type"] == "http.response.start":
                additions = [
                    (b"cache-control", b"no-store"),
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                ]
                message["headers"] = [
                    (k, v)
                    for k, v in message.get("headers", [])
                    if k.lower() not in {k for k, v in additions}
                ] + additions
            await send(message)

        async def reject(status, message):
            await JSONResponse({"error": message}, status_code=status)(scope, receive, secure_send)

        if not scope["path"].startswith("/api"):
            return await self.app(scope, receive, secure_send)
        headers = dict(scope.get("headers", []))
        if scope["method"] not in ["GET", "HEAD", "OPTIONS"]:
            origin = headers.get(b"origin", b"").decode("latin1")
            if (origin and origin != self.settings.origin) or (
                self.settings.production and not origin
            ):
                return await reject(403, "Request origin is not allowed.")
        now = time.monotonic()
        is_auth = scope["path"] in ["/api/auth/login", "/api/auth/register", "/api/auth/demo"]
        key = ((scope.get("client") or ("unknown", 0))[0], is_auth)
        window, maximum = (900, self.settings.auth_limit) if is_auth else (60, 600)
        with self.lock:
            if len(self.hits) > 2000:
                self.hits = defaultdict(
                    deque, {k: v for k, v in self.hits.items() if v and v[-1] > now - 900}
                )
            queue = self.hits[key]
            while queue and queue[0] <= now - window:
                queue.popleft()
            limited = len(queue) >= maximum or len(self.hits) > 2000
            if not limited:
                queue.append(now)
        if limited:
            return await reject(429, "Too many requests. Please try again later.")
        chunks, length = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            length += len(chunk)
            if length > 32768:
                return await reject(413, "JSON request exceeds the 32 KB limit.")
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        sent = False

        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        await self.app(scope, replay, secure_send)
