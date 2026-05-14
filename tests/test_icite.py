"""Tests for the async iCite client."""

from __future__ import annotations

from typing import Any

import httpx
import pytest
import respx

from uccc_pubmed_grader.icite import ICITE_COLUMNS, BatchResult, ICiteClient, ICiteError

BASE = "https://icite.od.nih.gov/api"


def _record(pmid: int, **overrides: Any) -> dict[str, Any]:
    base = {
        "pmid": pmid,
        "year": 2021,
        "title": f"Paper {pmid}",
        "authors": "Smith J, Doe J",
        "journal": "Nature",
        "is_research_article": True,
        "relative_citation_ratio": 1.5,
        "nih_percentile": 80.0,
        "human": 1.0,
        "animal": 0.0,
        "molecular_cellular": 0.0,
        "apt": 0.7,
        "is_clinical": False,
        "citation_count": 42,
        "citations_per_year": 14.0,
        "expected_citations_per_year": 11.5,
        "field_citation_rate": 7.6,
        "provisional": False,
        "x_coord": 0.5,
        "y_coord": -0.3,
        "cited_by_clin": "",
        "cited_by": "",
        "references": "",
        "doi": f"10.0/{pmid}",
        "last_modified": "2024-01-01",
    }
    base.update(overrides)
    return base


@respx.mock
async def test_fetch_batch_happy_path() -> None:
    route = respx.get(f"{BASE}/pubs").mock(
        return_value=httpx.Response(200, json={"data": [_record(111), _record(222)]})
    )
    async with ICiteClient(base_url=BASE) as client:
        result = await client.fetch_batch(["111", "222"])

    assert route.called
    assert set(result.records) == {"111", "222"}
    assert result.missing == ()
    assert result.records["111"]["title"] == "Paper 111"


@respx.mock
async def test_fetch_batch_partial_miss() -> None:
    respx.get(f"{BASE}/pubs").mock(return_value=httpx.Response(200, json={"data": [_record(111)]}))
    async with ICiteClient(base_url=BASE) as client:
        result = await client.fetch_batch(["111", "999"])

    assert result.missing == ("999",)
    assert "111" in result.records


@respx.mock
async def test_fetch_batch_retries_on_503() -> None:
    route = respx.get(f"{BASE}/pubs").mock(
        side_effect=[
            httpx.Response(503),
            httpx.Response(200, json={"data": [_record(111)]}),
        ]
    )
    async with ICiteClient(base_url=BASE, max_attempts=3) as client:
        result = await client.fetch_batch(["111"])

    assert route.call_count == 2
    assert "111" in result.records


@respx.mock
async def test_fetch_batch_raises_on_4xx() -> None:
    respx.get(f"{BASE}/pubs").mock(return_value=httpx.Response(400))
    async with ICiteClient(base_url=BASE) as client:
        with pytest.raises(httpx.HTTPStatusError):
            await client.fetch_batch(["111"])


@respx.mock
async def test_fetch_many_honors_batch_size() -> None:
    route = respx.get(f"{BASE}/pubs").mock(return_value=httpx.Response(200, json={"data": []}))
    async with ICiteClient(base_url=BASE, batch_size=3) as client:
        batches = [b async for b in client.fetch_many(["1", "2", "3", "4", "5", "6", "7"])]

    assert route.call_count == 3  # 3 + 3 + 1
    assert [len(b.requested) for b in batches] == [3, 3, 1]


@respx.mock
async def test_fetch_many_empty_input() -> None:
    route = respx.get(f"{BASE}/pubs")
    async with ICiteClient(base_url=BASE) as client:
        batches = [b async for b in client.fetch_many([])]
    assert batches == []
    assert not route.called


@respx.mock
async def test_unexpected_response_shape_raises() -> None:
    respx.get(f"{BASE}/pubs").mock(return_value=httpx.Response(200, json=["not", "a", "dict"]))
    async with ICiteClient(base_url=BASE) as client:
        with pytest.raises(ICiteError):
            await client.fetch_batch(["111"])


def test_batch_result_missing_property() -> None:
    result = BatchResult(requested=("1", "2", "3"), records={"2": _record(2)})
    assert result.missing == ("1", "3")


def test_icite_columns_immutable_and_documented() -> None:
    # Guard against accidental reordering — downstream CSV column order depends on this.
    assert isinstance(ICITE_COLUMNS, tuple)
    assert "relative_citation_ratio" in ICITE_COLUMNS
    assert ICITE_COLUMNS[0] == "year"


def test_invalid_batch_size_rejected() -> None:
    with pytest.raises(ValueError):
        ICiteClient(batch_size=0)


async def test_must_be_used_as_context_manager() -> None:
    client = ICiteClient()
    with pytest.raises(RuntimeError):
        await client.fetch_batch(["111"])
