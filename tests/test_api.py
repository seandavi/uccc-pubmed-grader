"""Integration tests for the upload → SSE → result API."""

from __future__ import annotations

import csv
import io
import json
import time
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from uccc_pubmed_grader.app import create_app
from uccc_pubmed_grader.icite import ICiteClient
from uccc_pubmed_grader.jobs import reset_default_store

ICITE_BASE = "https://icite.test/api"


def _icite_record(pmid: int, **overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "pmid": pmid,
        "year": 2020 + (pmid % 5),
        "title": f"Paper {pmid}",
        "authors": "Smith J",
        "journal": "Cell" if pmid % 2 == 0 else "Nature",
        "is_research_article": True,
        "relative_citation_ratio": 0.5 + (pmid % 5) * 0.7,
        "is_clinical": pmid % 3 == 0,
        "animal": 0.0,
        "apt": 0.6,
        "citation_count": pmid * 3,
        "last_modified": "2024-01-01",
    }
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def _clean_job_store() -> Iterator[None]:
    reset_default_store()
    yield
    reset_default_store()


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app()
    app.state.icite_client_factory = lambda: ICiteClient(
        base_url=ICITE_BASE, batch_size=50, max_attempts=2
    )
    with TestClient(app) as c:
        yield c


def _make_csv(pmids: list[int], extra_cols: dict[str, list[str]] | None = None) -> bytes:
    extra_cols = extra_cols or {}
    fieldnames = ["pmid", *extra_cols.keys()]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for i, pmid in enumerate(pmids):
        row = {"pmid": str(pmid)}
        for k, v in extra_cols.items():
            row[k] = v[i]
        writer.writerow(row)
    return buf.getvalue().encode("utf-8")


def _wait_for_done(client: TestClient, job_id: str, timeout: float = 5.0) -> list[dict[str, Any]]:
    """Subscribe to SSE and return parsed progress events. Raises on timeout."""
    deadline = time.time() + timeout
    events: list[dict[str, Any]] = []
    with client.stream("GET", f"/api/jobs/{job_id}/events") as resp:
        assert resp.status_code == 200
        current_event = ""
        for line in resp.iter_lines():
            if not line:
                continue
            if line.startswith("event:"):
                current_event = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                payload = json.loads(line.split(":", 1)[1].strip())
                events.append({"event": current_event, **payload})
                if current_event == "final":
                    return events
            if time.time() > deadline:
                raise AssertionError(f"timeout after events: {events}")
    return events


def test_health() -> None:
    app = create_app()
    with TestClient(app) as c:
        assert c.get("/api/health").json()["status"] == "ok"


@respx.mock
def test_upload_to_done_flow(client: TestClient) -> None:
    respx.get(f"{ICITE_BASE}/pubs").mock(
        return_value=httpx.Response(200, json={"data": [_icite_record(p) for p in (111, 222, 333)]})
    )
    csv_bytes = _make_csv([111, 222, 333], {"note": ["a", "b", "c"]})
    resp = client.post(
        "/api/jobs",
        files={"file": ("input.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]
    assert job_id

    events = _wait_for_done(client, job_id)
    phases = [e.get("phase") for e in events if e["event"] == "progress"]
    assert "parsing" in phases
    assert "fetching" in phases
    assert "summarizing" in phases
    assert "done" in phases
    assert events[-1]["event"] == "final"
    assert events[-1]["status"] == "done"

    summary = client.get(f"/api/jobs/{job_id}/summary").json()
    assert summary["matched"] == 3
    assert summary["total_rows"] == 3
    assert summary["invalid"] == 0

    result = client.get(f"/api/jobs/{job_id}/result")
    assert result.status_code == 200
    assert result.headers["content-type"].startswith("text/csv")
    text = result.text
    reader = csv.DictReader(io.StringIO(text))
    assert reader.fieldnames is not None
    assert "pmid" in reader.fieldnames
    assert "note" in reader.fieldnames
    assert "relative_citation_ratio" in reader.fieldnames
    rows = list(reader)
    assert [r["pmid"] for r in rows] == ["111", "222", "333"]


@respx.mock
def test_upload_with_custom_pmid_column(client: TestClient) -> None:
    respx.get(f"{ICITE_BASE}/pubs").mock(
        return_value=httpx.Response(200, json={"data": [_icite_record(111)]})
    )
    csv_text = "id,pubmed_id\nrow1,111\n"
    resp = client.post(
        "/api/jobs?pmid_column=pubmed_id",
        files={"file": ("input.csv", csv_text.encode(), "text/csv")},
    )
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]
    events = _wait_for_done(client, job_id)
    assert events[-1]["status"] == "done"


def test_upload_rejects_non_csv_extension(client: TestClient) -> None:
    resp = client.post(
        "/api/jobs",
        files={"file": ("input.txt", b"pmid\n111\n", "text/plain")},
    )
    assert resp.status_code == 400


def test_upload_rejects_empty_body(client: TestClient) -> None:
    resp = client.post(
        "/api/jobs",
        files={"file": ("input.csv", b"   \n", "text/csv")},
    )
    assert resp.status_code == 400


@respx.mock
def test_invalid_pmid_column_surfaces_as_error_event(client: TestClient) -> None:
    csv_text = "foo,bar\n1,2\n"
    resp = client.post("/api/jobs", files={"file": ("input.csv", csv_text.encode(), "text/csv")})
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]
    events = _wait_for_done(client, job_id)
    phases = [e.get("phase") for e in events if e["event"] == "progress"]
    assert "error" in phases
    assert events[-1]["status"] == "error"

    # Summary / result endpoints should refuse with 409 until done
    assert client.get(f"/api/jobs/{job_id}/summary").status_code == 409
    assert client.get(f"/api/jobs/{job_id}/result").status_code == 409


def test_unknown_job_returns_404(client: TestClient) -> None:
    assert client.get("/api/jobs/does-not-exist/summary").status_code == 404
    assert client.get("/api/jobs/does-not-exist/result").status_code == 404
    assert client.get("/api/jobs/does-not-exist/events").status_code == 404


def test_upload_rejects_oversize(monkeypatch: pytest.MonkeyPatch) -> None:
    from uccc_pubmed_grader import config

    def _tiny() -> config.Settings:
        return config.Settings(max_upload_bytes=10)

    app = create_app()
    app.dependency_overrides[config.get_settings] = _tiny
    with TestClient(app) as c:
        resp = c.post(
            "/api/jobs",
            files={"file": ("input.csv", b"pmid\n111\n222\n333\n444\n", "text/csv")},
        )
        assert resp.status_code == 413
