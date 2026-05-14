# Common dev/ops tasks. Run `just` to list.

set dotenv-load := true

default:
    @just --list

# --- Frontend (the whole app) -------------------------------------------

# Install frontend deps
install:
    cd frontend && bun install

# Run the Vite dev server
dev:
    cd frontend && bun run dev

# Build the static SPA for production
build:
    cd frontend && bun run build

# Run unit + component tests
test *ARGS:
    cd frontend && bun run test {{ARGS}}

# Type-check (no emit)
lint:
    cd frontend && bun run lint

# --- E2E ----------------------------------------------------------------

# Run the Playwright suite against a running dev server
e2e:
    cd frontend && bun run e2e

# --- Docker -------------------------------------------------------------

# Build and run the static SPA via Docker Compose (nginx behind Traefik)
up:
    docker compose up --build

down:
    docker compose down

# --- CI -----------------------------------------------------------------

# Everything CI runs
ci: lint test build
