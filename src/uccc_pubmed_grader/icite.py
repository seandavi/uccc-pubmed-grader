"""Async client for the NIH iCite API (https://icite.od.nih.gov/api).

iCite returns bibliometric and impact metrics for PubMed IDs. The `/api/pubs`
endpoint accepts a comma-separated `pmids` query parameter (in practice
hundreds per request) and returns a `{ "data": [...] }` payload of records
keyed by PMID. Unknown PMIDs are simply omitted from `data`.

This client:
- Batches input PMIDs (default 200/request).
- Streams batch results so callers can drive per-batch progress reporting.
- Retries transient failures (network errors, 5xx, 429) with exponential backoff.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Iterable, Sequence
from dataclasses import dataclass
from types import TracebackType
from typing import Any, Self

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


# The iCite columns we expose downstream. Order matters: this is the order in
# which they're appended to the augmented CSV. Keep this list aligned with what
# the iCite API documents at https://icite.od.nih.gov/api.
ICITE_COLUMNS: tuple[str, ...] = (
    "year",
    "title",
    "authors",
    "journal",
    "is_research_article",
    "relative_citation_ratio",
    "nih_percentile",
    "human",
    "animal",
    "molecular_cellular",
    "apt",
    "is_clinical",
    "citation_count",
    "citations_per_year",
    "expected_citations_per_year",
    "field_citation_rate",
    "provisional",
    "x_coord",
    "y_coord",
    "cited_by_clin",
    "cited_by",
    "references",
    "doi",
    "last_modified",
)


class ICiteError(RuntimeError):
    """Raised when iCite returns an unrecoverable error."""


@dataclass(frozen=True, slots=True)
class BatchResult:
    """One batch of iCite lookups."""

    requested: tuple[str, ...]
    records: dict[str, dict[str, Any]]  # pmid (str) -> iCite record

    @property
    def missing(self) -> tuple[str, ...]:
        return tuple(p for p in self.requested if p not in self.records)


class ICiteClient:
    """Async client for the NIH iCite API.

    Usage::

        async with ICiteClient() as client:
            async for batch in client.fetch_many(pmids):
                ...
    """

    def __init__(
        self,
        *,
        base_url: str = "https://icite.od.nih.gov/api",
        batch_size: int = 200,
        timeout: float = 30.0,
        max_attempts: int = 4,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if batch_size < 1:
            raise ValueError("batch_size must be >= 1")
        self._base_url = base_url.rstrip("/")
        self._batch_size = batch_size
        self._timeout = timeout
        self._max_attempts = max_attempts
        self._client = client
        self._owns_client = client is None

    async def __aenter__(self) -> Self:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    async def fetch_batch(self, pmids: Sequence[str]) -> BatchResult:
        """Fetch a single batch of PMIDs from iCite."""
        if not pmids:
            return BatchResult(requested=(), records={})
        if self._client is None:
            raise RuntimeError("ICiteClient must be used as an async context manager")

        url = f"{self._base_url}/pubs"
        params = {"pmids": ",".join(pmids)}

        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(self._max_attempts),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
            retry=retry_if_exception_type(
                (httpx.TransportError, httpx.HTTPStatusError, ICiteError)
            ),
            reraise=True,
        ):
            with attempt:
                response = await self._client.get(url, params=params)
                if response.status_code in (429, 500, 502, 503, 504):
                    raise ICiteError(f"iCite returned retryable status {response.status_code}")
                response.raise_for_status()
                payload = response.json()

        if not isinstance(payload, dict) or "data" not in payload:
            raise ICiteError(f"unexpected iCite response shape: {type(payload).__name__}")

        records: dict[str, dict[str, Any]] = {}
        for item in payload.get("data", []):
            pmid = item.get("pmid")
            if pmid is None:
                continue
            records[str(pmid)] = item

        return BatchResult(requested=tuple(pmids), records=records)

    async def fetch_many(self, pmids: Iterable[str]) -> AsyncIterator[BatchResult]:
        """Yield BatchResult per batch. Caller drives progress from this stream."""
        batch: list[str] = []
        for pmid in pmids:
            batch.append(pmid)
            if len(batch) >= self._batch_size:
                yield await self.fetch_batch(batch)
                batch = []
        if batch:
            yield await self.fetch_batch(batch)
