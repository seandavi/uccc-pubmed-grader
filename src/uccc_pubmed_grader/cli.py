"""Command-line entrypoint."""

from __future__ import annotations

import typer
import uvicorn

app = typer.Typer(help="UCCC PubMed Grader.")


@app.command()
def serve(
    host: str = "0.0.0.0",
    port: int = 8000,
    reload: bool = False,
) -> None:
    """Run the FastAPI server."""
    uvicorn.run(
        "uccc_pubmed_grader.app:app",
        host=host,
        port=port,
        reload=reload,
    )


if __name__ == "__main__":
    app()
