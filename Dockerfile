FROM node:22-bookworm-slim AS web
WORKDIR /app
RUN npm install -g pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN pnpm build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt && useradd --create-home sentinel && mkdir /data && chown sentinel:sentinel /data
COPY backend/app ./backend/app
COPY --from=web /app/dist ./dist
ENV DATABASE_PATH=/data/sentinel.db APP_ORIGIN=http://localhost:8082 ENVIRONMENT=development
USER sentinel
EXPOSE 8082
CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8082", "--workers", "1", "--no-access-log"]
