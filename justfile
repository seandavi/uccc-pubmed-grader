# Common dev/ops tasks. Run `just` to list.

set dotenv-load := true

default:
    @just --list

# --- Python -------------------------------------------------------------

# Install Python deps (creates .venv via uv)
install:
    uv sync --extra dev

# Run the FastAPI dev server with auto-reload
dev:
    uv run pubmed-grader serve --reload

# Run the test suite
test *ARGS:
    uv run pytest {{ARGS}}

# Lint with ruff
lint:
    uv run ruff check src tests
    uv run ruff format --check src tests

# Auto-fix what ruff can
fmt:
    uv run ruff check --fix src tests
    uv run ruff format src tests

# Type-check
typecheck:
    uv run mypy src

# --- Frontend -----------------------------------------------------------

# Install frontend deps
fe-install:
    cd frontend && bun install

# Run the frontend dev server
fe-dev:
    cd frontend && bun run dev

# Build the frontend for production
fe-build:
    cd frontend && bun run build

# Run frontend tests
fe-test:
    cd frontend && bun run test

# --- E2E ----------------------------------------------------------------

# Run the e2e Playwright suite (assumes services are up)
e2e:
    cd frontend && bun run e2e

# --- Docker -------------------------------------------------------------

# Build and run the full stack via Docker Compose
up:
    docker compose up --build

# Stop the stack
down:
    docker compose down

# --- CI -----------------------------------------------------------------

# Everything CI runs
ci: lint typecheck test
