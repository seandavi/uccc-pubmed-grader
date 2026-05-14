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

# Preview the production build locally
preview:
    cd frontend && bun run build && bunx vite preview

# Run unit + component tests
test *ARGS:
    cd frontend && bun run test {{ARGS}}

# Type-check (no emit)
lint:
    cd frontend && bun run lint

# --- E2E ----------------------------------------------------------------

# One-time install of Playwright browsers
e2e-install:
    cd frontend && bun run e2e:install

# Run the Playwright suite (boots its own vite preview)
e2e:
    cd frontend && bun run e2e

# --- CI -----------------------------------------------------------------

# Everything CI runs
ci: lint test build e2e
