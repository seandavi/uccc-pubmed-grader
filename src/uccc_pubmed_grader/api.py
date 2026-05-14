"""HTTP endpoints for upload → SSE progress → result download."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse

from uccc_pubmed_grader.config import Settings, get_settings
from uccc_pubmed_grader.icite import ICiteClient
from uccc_pubmed_grader.jobs import Job, JobStatus, JobStore, get_default_store
from uccc_pubmed_grader.processor import process_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["jobs"])


def get_store(settings: Annotated[Settings, Depends(get_settings)]) -> JobStore:
    return get_default_store(ttl_seconds=settings.job_ttl_seconds)


SettingsDep = Annotated[Settings, Depends(get_settings)]
StoreDep = Annotated[JobStore, Depends(get_store)]


async def _read_upload(file: UploadFile, max_bytes: int) -> bytes:
    """Read the upload, refusing to exceed `max_bytes` to bound memory use."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"upload exceeds max size of {max_bytes} bytes",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _build_icite_client(settings: Settings) -> ICiteClient:
    return ICiteClient(
        base_url=settings.icite_base_url,
        batch_size=settings.icite_batch_size,
        timeout=settings.icite_timeout_seconds,
    )


@router.post("/jobs", status_code=202)
async def create_job(
    request: Request,
    settings: SettingsDep,
    store: StoreDep,
    file: Annotated[UploadFile, File(description="CSV with a PMID column")],
    pmid_column: Annotated[
        str | None,
        Query(description="Override the PMID column name (case-insensitive)"),
    ] = None,
) -> dict[str, str]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="upload must be a .csv file")

    csv_bytes = await _read_upload(file, settings.max_upload_bytes)
    if not csv_bytes.strip():
        raise HTTPException(status_code=400, detail="CSV is empty")

    job = await store.create(pmid_column=pmid_column)
    # Allow tests to inject a pre-configured iCite client via app state.
    client_factory = getattr(request.app.state, "icite_client_factory", None)
    icite_client = client_factory() if client_factory else _build_icite_client(settings)
    asyncio.create_task(process_job(job, csv_bytes, icite_client=icite_client))
    return {"job_id": job.id}


async def _get_job(store: JobStore, job_id: str) -> Job:
    job = await store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job


@router.get("/jobs/{job_id}/events")
async def job_events(job_id: str, store: StoreDep) -> EventSourceResponse:
    job = await _get_job(store, job_id)

    async def event_source() -> AsyncIterator[dict[str, str]]:
        async for event in store.subscribe(job):
            yield {"event": "progress", "data": json.dumps(event.as_dict())}
        # Terminal event so the client can stop listening even if it missed the
        # phase=done event in the stream above.
        yield {
            "event": "final",
            "data": json.dumps(
                {
                    "status": job.status.value,
                    "error": job.error_message,
                }
            ),
        }

    return EventSourceResponse(event_source())


@router.get("/jobs/{job_id}/summary")
async def job_summary(job_id: str, store: StoreDep) -> dict[str, object]:
    job = await _get_job(store, job_id)
    if job.status != JobStatus.done or job.summary is None:
        raise HTTPException(
            status_code=409,
            detail=f"summary not ready (status={job.status.value})",
        )
    return job.summary


@router.get("/jobs/{job_id}/result")
async def job_result(job_id: str, store: StoreDep) -> Response:
    job = await _get_job(store, job_id)
    if job.status != JobStatus.done or job.csv_bytes is None:
        raise HTTPException(
            status_code=409,
            detail=f"result not ready (status={job.status.value})",
        )
    return Response(
        content=job.csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": (f'attachment; filename="pubmed-grader-{job.id[:8]}.csv"'),
        },
    )
