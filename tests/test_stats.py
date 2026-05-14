"""Tests for summary stat computation."""

from __future__ import annotations

from typing import Any

from uccc_pubmed_grader.stats import compute_summary


def _rec(pmid: int, **kwargs: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "pmid": pmid,
        "year": 2021,
        "title": f"Paper {pmid}",
        "journal": "Nature",
        "relative_citation_ratio": 1.5,
        "citation_count": 10,
        "is_clinical": False,
        "animal": 0.0,
        "apt": 0.5,
    }
    base.update(kwargs)
    return base


def test_summary_counts() -> None:
    records = {"111": _rec(111), "222": _rec(222)}
    s = compute_summary(
        total_rows=4,
        invalid=1,
        requested_pmids=["111", "222", "333"],
        records=records,
    )
    assert s.total_rows == 4
    assert s.matched == 2
    assert s.missing == 1
    assert s.invalid == 1


def test_rcr_mean_median_and_thresholds() -> None:
    records = {
        "1": _rec(1, relative_citation_ratio=0.5),
        "2": _rec(2, relative_citation_ratio=1.5),
        "3": _rec(3, relative_citation_ratio=2.5),
        "4": _rec(4, relative_citation_ratio=4.0),
    }
    s = compute_summary(total_rows=4, invalid=0, requested_pmids=list(records), records=records)
    assert s.rcr_mean == 2.125
    assert s.rcr_median == 2.0
    assert s.rcr_above_1_pct == 75.0
    assert s.rcr_above_2_pct == 50.0


def test_rcr_histogram_buckets() -> None:
    rcrs = [0.1, 0.6, 1.2, 1.7, 2.5, 4.0, 7.0, 15.0]
    records = {str(i): _rec(i, relative_citation_ratio=v) for i, v in enumerate(rcrs, start=1)}
    s = compute_summary(
        total_rows=len(rcrs), invalid=0, requested_pmids=list(records), records=records
    )
    counts = {b.label: b.count for b in s.rcr_histogram}
    # 0.1 in [0, 0.5); 0.6 in [0.5, 1); 1.2 in [1, 1.5); 1.7 in [1.5, 2);
    # 2.5 in [2, 3); 4.0 in [3, 5); 7.0 in [5, 10); 15.0 in [10, +inf)
    assert counts["0–0.5"] == 1
    assert counts["0.5–1"] == 1
    assert counts["1–1.5"] == 1
    assert counts["1.5–2"] == 1
    assert counts["2–3"] == 1
    assert counts["3–5"] == 1
    assert counts["5–10"] == 1
    assert counts["10+"] == 1


def test_rcr_ignores_missing_and_nan() -> None:
    records = {
        "1": _rec(1, relative_citation_ratio=1.0),
        "2": _rec(2, relative_citation_ratio=None),
        "3": _rec(3, relative_citation_ratio="not a number"),
    }
    s = compute_summary(total_rows=3, invalid=0, requested_pmids=list(records), records=records)
    assert s.rcr_mean == 1.0
    assert s.rcr_median == 1.0


def test_top_journals() -> None:
    records = {
        "1": _rec(1, journal="Cell"),
        "2": _rec(2, journal="Cell"),
        "3": _rec(3, journal="Nature"),
        "4": _rec(4, journal=""),
    }
    s = compute_summary(total_rows=4, invalid=0, requested_pmids=list(records), records=records)
    assert s.top_journals[0].journal == "Cell"
    assert s.top_journals[0].count == 2
    assert s.top_journals[1].journal == "Nature"
    assert len(s.top_journals) == 2  # blank journal excluded


def test_year_histogram_sorted() -> None:
    records = {
        "1": _rec(1, year=2020),
        "2": _rec(2, year=2022),
        "3": _rec(3, year=2020),
    }
    s = compute_summary(total_rows=3, invalid=0, requested_pmids=list(records), records=records)
    labels = [b.label for b in s.year_histogram]
    counts = {b.label: b.count for b in s.year_histogram}
    assert labels == sorted(labels)
    assert counts["2020"] == 2
    assert counts["2022"] == 1


def test_clinical_animal_apt_percentages() -> None:
    records = {
        "1": _rec(1, is_clinical=True, animal=0.0, apt=0.9),
        "2": _rec(2, is_clinical=False, animal=0.9, apt=0.4),
        "3": _rec(3, is_clinical=False, animal=0.0, apt=0.5),
        "4": _rec(4, is_clinical=True, animal=0.0, apt=0.1),
    }
    s = compute_summary(total_rows=4, invalid=0, requested_pmids=list(records), records=records)
    assert s.pct_clinical == 50.0
    assert s.pct_animal == 25.0
    assert s.pct_has_translation_potential == 50.0  # APT >= 0.5 in #1 and #3


def test_top_cited_papers_sorted_desc_and_limited() -> None:
    records = {str(i): _rec(i, citation_count=i * 10) for i in range(1, 15)}
    s = compute_summary(
        total_rows=14,
        invalid=0,
        requested_pmids=list(records),
        records=records,
        top_n_papers=5,
    )
    assert len(s.top_cited_papers) == 5
    counts = [p.citation_count for p in s.top_cited_papers]
    assert counts == sorted(counts, reverse=True)
    assert counts[0] == 140


def test_empty_input_returns_zeros_and_nones() -> None:
    s = compute_summary(total_rows=0, invalid=0, requested_pmids=[], records={})
    assert s.matched == 0
    assert s.missing == 0
    assert s.rcr_mean is None
    assert s.rcr_median is None
    assert s.rcr_above_1_pct is None
    assert s.top_journals == []
    assert s.top_cited_papers == []


def test_to_dict_shape() -> None:
    s = compute_summary(
        total_rows=1, invalid=0, requested_pmids=["111"], records={"111": _rec(111)}
    )
    d = s.to_dict()
    assert set(d) == {
        "total_rows",
        "matched",
        "missing",
        "invalid",
        "rcr",
        "year_histogram",
        "top_journals",
        "pct_with_rcr",
        "pct_clinical",
        "pct_animal",
        "pct_has_translation_potential",
        "top_cited_papers",
    }
    assert set(d["rcr"]) == {"mean", "median", "above_1_pct", "above_2_pct", "histogram"}
