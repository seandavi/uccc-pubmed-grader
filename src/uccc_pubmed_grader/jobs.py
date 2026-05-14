"""In-memory job store driving the upload → SSE → result flow.

Each job moves through:
  pending -> running -> done | error

Progress is published as discrete events via an `asyncio.Queue` per job; the
SSE endpoint reads them. The CSV result and summary are stored on the job
after `done`.

This MVP store is single-process. Horizontal scaling requires sticky sessions
or a shared backend (Redis), called out in the README.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class JobStatus(StrEnum):
    pending = "pending"
    running = "running"
    done = "done"
    error = "error"


@dataclass
class ProgressEvent:
    phase: str  # "parsing" | "fetching" | "summarizing" | "done" | "error"
    processed: int = 0
    total: int = 0
    message: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "phase": self.phase,
            "processed": self.processed,
            "total": self.total,
            "message": self.message,
        }


@dataclass
class Job:
    id: str
    pmid_column: str | None
    created_at: float
    status: JobStatus = JobStatus.pending
    queue: asyncio.Queue[ProgressEvent | None] = field(default_factory=asyncio.Queue)
    csv_bytes: bytes | None = None
    summary: dict[str, Any] | None = None
    error_message: str | None = None

    async def publish(self, event: ProgressEvent) -> None:
        await self.queue.put(event)

    async def close(self) -> None:
        await self.queue.put(None)  # sentinel terminating the SSE stream


class JobStore:
    """In-memory job registry with TTL-based expiry."""

    def __init__(self, *, ttl_seconds: int = 3600) -> None:
        self._jobs: dict[str, Job] = {}
        self._ttl = ttl_seconds
        self._lock = asyncio.Lock()

    async def create(self, *, pmid_column: str | None) -> Job:
        async with self._lock:
            self._gc_locked()
            job = Job(
                id=uuid.uuid4().hex,
                pmid_column=pmid_column,
                created_at=time.time(),
            )
            self._jobs[job.id] = job
            return job

    async def get(self, job_id: str) -> Job | None:
        async with self._lock:
            self._gc_locked()
            return self._jobs.get(job_id)

    def _gc_locked(self) -> None:
        deadline = time.time() - self._ttl
        stale = [jid for jid, j in self._jobs.items() if j.created_at < deadline]
        for jid in stale:
            self._jobs.pop(jid, None)

    async def subscribe(self, job: Job) -> AsyncIterator[ProgressEvent]:
        """Yield progress events for `job` until the sentinel is received."""
        while True:
            event = await job.queue.get()
            if event is None:
                return
            yield event


_DEFAULT_STORE: JobStore | None = None


def get_default_store(ttl_seconds: int | None = None) -> JobStore:
    global _DEFAULT_STORE
    if _DEFAULT_STORE is None:
        _DEFAULT_STORE = JobStore(ttl_seconds=ttl_seconds or 3600)
    elif ttl_seconds is not None:
        _DEFAULT_STORE._ttl = ttl_seconds
    return _DEFAULT_STORE


def reset_default_store() -> None:
    """Test helper — clears the module-level default store."""
    global _DEFAULT_STORE
    _DEFAULT_STORE = None
