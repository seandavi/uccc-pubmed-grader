# syntax=docker/dockerfile:1.7
# Build the React frontend, then bundle with the FastAPI backend.

FROM oven/bun:1.1-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY frontend/ ./
RUN bun run build

FROM python:3.12-slim AS backend
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml ./
COPY src ./src
RUN uv sync --no-dev --frozen 2>/dev/null || uv sync --no-dev

COPY --from=frontend /fe/dist ./static

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "uccc_pubmed_grader.app:app", "--host", "0.0.0.0", "--port", "8000"]
