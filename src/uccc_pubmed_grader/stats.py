"""Compute summary statistics over a set of iCite records for the dashboard.

The shape of these stats is consumed directly by the frontend dashboard, so the
field names here are part of the API contract.
"""

from __future__ import annotations

import math
import statistics
from collections import Counter
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from typing import Any


# RCR histogram bucket edges (right-open). The last bucket captures everything
# at or above the final edge. Designed to highlight the meaningful breakpoints:
# below average (<1), strong (1-3), high impact (3-10), exceptional (10+).
RCR_BUCKET_EDGES: tuple[float, ...] = (0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0)


@dataclass(slots=True)
class HistogramBucket:
    label: str
    count: int


@dataclass(slots=True)
class TopPaper:
    pmid: str
    title: str
    journal: str
    year: int | None
    citation_count: int | None
    relative_citation_ratio: float | None


@dataclass(slots=True)
class JournalCount:
    journal: str
    count: int


@dataclass(slots=True)
class Summary:
    """Top-level dashboard payload. dict() form is what the API returns."""

    total_rows: int
    matched: int
    missing: int
    invalid: int

    rcr_mean: float | None
    rcr_median: float | None
    rcr_above_1_pct: float | None
    rcr_above_2_pct: float | None
    rcr_histogram: list[HistogramBucket]

    year_histogram: list[HistogramBucket]

    top_journals: list[JournalCount]

    pct_with_rcr: float | None  # share of matched records iCite was able to score
    pct_clinical: float | None
    pct_animal: float | None
    pct_has_translation_potential: float | None

    top_cited_papers: list[TopPaper]

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_rows": self.total_rows,
            "matched": self.matched,
            "missing": self.missing,
            "invalid": self.invalid,
            "rcr": {
                "mean": self.rcr_mean,
                "median": self.rcr_median,
                "above_1_pct": self.rcr_above_1_pct,
                "above_2_pct": self.rcr_above_2_pct,
                "histogram": [asdict(b) for b in self.rcr_histogram],
            },
            "year_histogram": [asdict(b) for b in self.year_histogram],
            "top_journals": [asdict(j) for j in self.top_journals],
            "pct_with_rcr": self.pct_with_rcr,
            "pct_clinical": self.pct_clinical,
            "pct_animal": self.pct_animal,
            "pct_has_translation_potential": self.pct_has_translation_potential,
            "top_cited_papers": [asdict(p) for p in self.top_cited_papers],
        }


def _safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f):
        return None
    return f


def _safe_int(value: Any) -> int | None:
    f = _safe_float(value)
    return int(f) if f is not None else None


def _safe_bool(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    return None


def _rcr_bucket_labels() -> list[str]:
    labels: list[str] = []
    for i, edge in enumerate(RCR_BUCKET_EDGES):
        if i + 1 < len(RCR_BUCKET_EDGES):
            labels.append(f"{edge:g}–{RCR_BUCKET_EDGES[i + 1]:g}")
        else:
            labels.append(f"{edge:g}+")
    return labels


def _bucket_rcr(values: Iterable[float]) -> list[HistogramBucket]:
    labels = _rcr_bucket_labels()
    counts = [0] * len(labels)
    edges = RCR_BUCKET_EDGES
    for v in values:
        placed = False
        for i in range(len(edges) - 1):
            if edges[i] <= v < edges[i + 1]:
                counts[i] += 1
                placed = True
                break
        if not placed:
            counts[-1] += 1
    return [HistogramBucket(label=labels[i], count=counts[i]) for i in range(len(labels))]


def _pct_of(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round(100 * numerator / denominator, 2)


def compute_summary(
    *,
    total_rows: int,
    invalid: int,
    requested_pmids: Iterable[str],
    records: dict[str, dict[str, Any]],
    top_n_papers: int = 10,
    top_n_journals: int = 10,
) -> Summary:
    """Compute the dashboard summary.

    Args:
        total_rows: total rows in the source CSV (excluding header).
        invalid: count of rows with PMIDs that failed validation.
        requested_pmids: PMIDs sent to iCite (used to compute missing count).
        records: iCite records keyed by PMID (str).
    """
    requested_list = list(requested_pmids)
    matched_pmids = [p for p in requested_list if p in records]
    matched_records = [records[p] for p in matched_pmids]

    missing = len(requested_list) - len(matched_pmids)

    # RCR
    rcr_values = [
        v
        for v in (_safe_float(r.get("relative_citation_ratio")) for r in matched_records)
        if v is not None
    ]
    rcr_mean = round(statistics.fmean(rcr_values), 3) if rcr_values else None
    rcr_median = round(statistics.median(rcr_values), 3) if rcr_values else None
    rcr_above_1 = sum(1 for v in rcr_values if v > 1)
    rcr_above_2 = sum(1 for v in rcr_values if v > 2)
    rcr_above_1_pct = _pct_of(rcr_above_1, len(rcr_values))
    rcr_above_2_pct = _pct_of(rcr_above_2, len(rcr_values))
    rcr_histogram = _bucket_rcr(rcr_values)

    # Years
    year_counter: Counter[int] = Counter()
    for r in matched_records:
        y = _safe_int(r.get("year"))
        if y is not None:
            year_counter[y] += 1
    year_histogram = [
        HistogramBucket(label=str(y), count=year_counter[y])
        for y in sorted(year_counter)
    ]

    # Journals
    journal_counter: Counter[str] = Counter()
    for r in matched_records:
        j = (r.get("journal") or "").strip()
        if j:
            journal_counter[j] += 1
    top_journals = [
        JournalCount(journal=j, count=c) for j, c in journal_counter.most_common(top_n_journals)
    ]

    # Booleans / classifications
    def _count_bool(field: str) -> int:
        return sum(1 for r in matched_records if _safe_bool(r.get(field)) is True)

    def _count_animal() -> int:
        # iCite reports `animal` as a fraction in [0, 1]; treat > 0.5 as animal-dominant.
        n = 0
        for r in matched_records:
            v = _safe_float(r.get("animal"))
            if v is not None and v > 0.5:
                n += 1
        return n

    def _count_translation_potential() -> int:
        # APT: Approximate Potential to Translate, in [0, 1]. Treat >= 0.5 as "has potential."
        n = 0
        for r in matched_records:
            v = _safe_float(r.get("apt"))
            if v is not None and v >= 0.5:
                n += 1
        return n

    with_rcr = sum(
        1 for r in matched_records if _safe_float(r.get("relative_citation_ratio")) is not None
    )
    pct_with_rcr = _pct_of(with_rcr, len(matched_records))

    pct_clinical = _pct_of(_count_bool("is_clinical"), len(matched_records))
    pct_animal = _pct_of(_count_animal(), len(matched_records))
    pct_has_translation_potential = _pct_of(
        _count_translation_potential(), len(matched_records)
    )

    # Top cited papers
    def _citation_count(r: dict[str, Any]) -> int:
        c = _safe_int(r.get("citation_count"))
        return c if c is not None else -1

    top_cited = sorted(matched_records, key=_citation_count, reverse=True)[:top_n_papers]
    top_cited_papers = [
        TopPaper(
            pmid=str(r.get("pmid", "")),
            title=str(r.get("title") or ""),
            journal=str(r.get("journal") or ""),
            year=_safe_int(r.get("year")),
            citation_count=_safe_int(r.get("citation_count")),
            relative_citation_ratio=_safe_float(r.get("relative_citation_ratio")),
        )
        for r in top_cited
    ]

    return Summary(
        total_rows=total_rows,
        matched=len(matched_pmids),
        missing=missing,
        invalid=invalid,
        rcr_mean=rcr_mean,
        rcr_median=rcr_median,
        rcr_above_1_pct=rcr_above_1_pct,
        rcr_above_2_pct=rcr_above_2_pct,
        rcr_histogram=rcr_histogram,
        year_histogram=year_histogram,
        top_journals=top_journals,
        pct_with_rcr=pct_with_rcr,
        pct_clinical=pct_clinical,
        pct_animal=pct_animal,
        pct_has_translation_potential=pct_has_translation_potential,
        top_cited_papers=top_cited_papers,
    )
