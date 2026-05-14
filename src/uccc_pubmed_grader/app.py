"""FastAPI application factory. Real endpoints land in later PRs."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from uccc_pubmed_grader import __version__


def create_app() -> FastAPI:
    app = FastAPI(
        title="UCCC PubMed Grader",
        version=__version__,
        description="Append NIH iCite metrics to a CSV of PubMed IDs.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # tightened by Traefik in prod
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    return app


app = create_app()
