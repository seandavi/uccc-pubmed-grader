# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

The repository has not been scaffolded yet — only `README.md` exists. There is no package layout, no dependency manifest, and no committed code. Treat the README as the spec, not as documentation of an existing system.

## Product

A web app that accepts a CSV containing a column of PubMed IDs (default column name `pmid`, case-insensitive; column name is user-overridable) plus arbitrary other columns. For each PMID it calls the NIH iCite API, appends all iCite fields to the original row, and returns the augmented CSV.

Inputs can be large, so processing is asynchronous: the upload endpoint returns a job handle; the client polls for status and downloads the result when ready.

- Backend: FastAPI (async throughout — `httpx.AsyncClient`, `aiofiles`, etc.)
- Frontend: React, with `bun` as the package manager / runner where possible
- Persistence (if/when needed): Postgres via SQLAlchemy async + `asyncpg`. No sync DB drivers.
- External dependency: iCite API (https://icite.od.nih.gov/api) — the contract on which iCite columns are appended is whatever that API returns; do not hard-code the column list.
- Task running: `justfile` for common dev/ops commands as the project grows.
- Deployment: Docker Compose, fronted by Traefik.

## Architectural constraints to honor when scaffolding

- **Async end-to-end on the backend.** iCite calls and any file I/O must use async libraries (e.g., `httpx.AsyncClient`, `aiofiles`). Do not block the event loop on sync `requests` or sync file reads — this is the whole reason the design is async.
- **Job-handle pattern, not request/response.** Upload must return immediately with an ID; the actual fetch + CSV augmentation runs in the background (FastAPI `BackgroundTasks` for a single-process MVP; a real task queue if/when it grows). Status and download are separate endpoints keyed by that ID.
- **Batch iCite requests.** iCite supports multi-PMID lookups — do not issue one HTTP call per row.
- **Preserve the user's original columns and row order** in the output CSV; iCite columns are appended.

## Tooling preferences

- Python: `uv` for dependency management; **src layout** from the start; type hints throughout; `pathlib.Path` or `upath` for paths; `click`/`typer` for any CLI.
- Frontend: `bun` where possible.
- Secrets: `.env` (gitignored) for local dev; **GCP Secret Manager** for any non-dev/"official" deployment. Code should read from env vars in both cases — the GCP→env wiring happens at deploy time, not in app code.
- Deployment: Docker Compose. Traefik handles ingress/TLS; reference config lives at `monode/infrastructure/compose/traefik` (outside this repo).
- Reference implementation: the `nextflow_telemetry` repo has working examples of this same stack (FastAPI + async + Postgres + Docker Compose + Traefik) — consult it before inventing patterns from scratch.
- Commit thoroughly and often; branch or use a worktree for substantial changes rather than working on `main`.
