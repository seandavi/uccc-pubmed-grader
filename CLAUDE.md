# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

A static web app that accepts a CSV containing a column of PubMed IDs (default `pmid`, case-insensitive; overridable), then in the user's browser calls the NIH iCite API to augment each row with bibliometric metrics. After processing it renders a one-page editorial-styled dashboard (RCR distribution, publication year histogram, top journals, top-cited papers) and lets the user download the augmented CSV. There is also an About page that explains the metrics and methodology.

iCite enables CORS for browser origins, so no backend is required. **The entire app runs in the browser.** This was a deliberate pivot from an earlier FastAPI + SSE design; do not re-introduce a backend without first questioning whether it's needed.

## Stack

- **Frontend:** React 18 + TypeScript + Vite, installed and built with **bun**.
- **Routing:** `react-router-dom` (BrowserRouter). Two routes: `/` (Grader) and `/about` (About).
- **CSV parsing:** `papaparse` (handles quoting, BOM, blank lines).
- **Styling:** Tailwind with a custom palette (`paper`, `ink`, `gold`, `oxblood`, `rule`) and three fonts: `Fraunces` (display serif), `DM Sans` (body), `JetBrains Mono` (tabular figures, eyebrows). The visual identity is editorial / scientific quarterly — magazine-style asymmetric grid, small-caps section labels (`.eyebrow`), tabular numerals everywhere stats live.
- **Charts:** `recharts`.
- **Tests:** `vitest` + `@testing-library/react` + jsdom for unit; `@playwright/test` for e2e (boots its own `vite preview`).
- **Deployment:** Netlify (config in `netlify.toml`; `_redirects`-style SPA fallback is inlined there). Custom domain + CNAME are configured in the Netlify UI.
- **Analytics:** Google Analytics 4, loaded only when `VITE_GA_MEASUREMENT_ID` is set at build time. The `track()` helper in `src/lib/analytics.ts` is a no-op otherwise.

## Architecture (very short)

- `src/lib/icite.ts` — async generator that batches PMIDs (default 200/call) and retries transient failures.
- `src/lib/csv.ts` — papaparse-backed CSV parser + augmenter; renames colliding iCite columns with an `icite_` prefix so user data is preserved.
- `src/lib/stats.ts` — pure functions that compute the dashboard summary (RCR mean/median/thresholds, RCR + year histograms, top journals, top-cited papers).
- `src/lib/analytics.ts` — GA4 wrapper, gated on `VITE_GA_MEASUREMENT_ID`.
- `src/hooks/useGrading.ts` — orchestrates parse → fetch → stats → Blob URL.
- `src/pages/{Grader,About}.tsx` — the two routes.
- `src/components/{Header,Footer,UploadPanel,ProgressPanel,Dashboard,StatCard,RuleHeading}.tsx`.

## Tooling preferences

- **bun** for everything (`bun install`, `bun run dev`, `bun run test`, `bun run build`, `bun run e2e`).
- `just` aggregates the common tasks (`just install`, `just dev`, `just test`, `just build`, `just preview`, `just e2e`, `just ci`).
- `.env` (gitignored) for local dev; **Netlify environment variables** (set in the UI) for production. The only secret currently is `VITE_GA_MEASUREMENT_ID`.
- Commit thoroughly and often; branch for substantial changes.

## Don't

- Don't reintroduce a Python backend, a job queue, or an upload endpoint. Files are read in the browser via `FileReader`; the augmented CSV is produced as a `Blob` URL. If you find yourself reaching for a backend, the answer is almost certainly "no, we don't need one."
- Don't switch the visual identity to a generic dashboard look. The editorial typography + cream/ink/gold palette is the product's personality.
- Don't reintroduce Docker / nginx / Traefik for this repo — Netlify owns build + serve now. (If you need to self-host later, the previous Dockerfile is recoverable from git history.)
