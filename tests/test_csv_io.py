"""Tests for CSV parsing and augmentation."""

from __future__ import annotations

import csv
import io

import pytest

from uccc_pubmed_grader.csv_io import (
    CSVParseError,
    iter_valid_pmid_chunks,
    parse_csv,
    write_augmented_csv,
)


def test_parse_csv_default_pmid_header() -> None:
    csv_text = "pmid,author\n111,Smith\n222,Doe\n"
    parsed = parse_csv(csv_text)
    assert parsed.pmid_column == "pmid"
    assert parsed.valid_pmids == ["111", "222"]
    assert parsed.invalid_rows == []
    assert parsed.total_rows == 2


def test_parse_csv_header_case_insensitive() -> None:
    parsed = parse_csv("PMID,author\n111,Smith\n")
    assert parsed.pmid_column == "PMID"
    assert parsed.valid_pmids == ["111"]


def test_parse_csv_custom_column_override() -> None:
    csv_text = "id,pubmed_id,title\n1,111,Foo\n2,222,Bar\n"
    parsed = parse_csv(csv_text, pmid_column="pubmed_id")
    assert parsed.pmid_column == "pubmed_id"
    assert parsed.valid_pmids == ["111", "222"]


def test_parse_csv_missing_column_raises() -> None:
    with pytest.raises(CSVParseError, match="not found"):
        parse_csv("foo,bar\n1,2\n")


def test_parse_csv_invalid_pmids_recorded_but_rows_kept() -> None:
    csv_text = "pmid,author\n111,Smith\nabc,Doe\n,Empty\n"
    parsed = parse_csv(csv_text)
    assert parsed.total_rows == 3
    assert parsed.valid_pmids == ["111"]
    assert [n for n, _ in parsed.invalid_rows] == [2, 3]


def test_parse_csv_dedupes_pmids() -> None:
    parsed = parse_csv("pmid\n111\n111\n222\n")
    assert parsed.valid_pmids == ["111", "222"]


def test_parse_csv_empty_input_raises() -> None:
    with pytest.raises(CSVParseError):
        parse_csv("   \n")


def test_parse_csv_bom_handled() -> None:
    csv_bytes = b"\xef\xbb\xbfpmid,author\n111,Smith\n"
    parsed = parse_csv(csv_bytes)
    assert parsed.pmid_column == "pmid"
    assert parsed.valid_pmids == ["111"]


def test_parse_csv_empty_column_name_rejected() -> None:
    with pytest.raises(CSVParseError, match="empty"):
        parse_csv("pmid\n111\n", pmid_column="   ")


def test_write_augmented_csv_appends_icite_columns() -> None:
    parsed = parse_csv("pmid,name\n111,A\n222,B\n")
    icite_cols = ("year", "title", "relative_citation_ratio")
    records: dict[str, dict[str, object]] = {
        "111": {"year": 2020, "title": "Paper A", "relative_citation_ratio": 1.5},
        "222": {"year": 2021, "title": "Paper B", "relative_citation_ratio": None},
    }
    augmented = write_augmented_csv(parsed, records, icite_cols)
    reader = csv.DictReader(io.StringIO(augmented))
    rows = list(reader)
    assert reader.fieldnames == ["pmid", "name", "year", "title", "relative_citation_ratio"]
    assert rows[0]["title"] == "Paper A"
    assert rows[1]["relative_citation_ratio"] == ""  # None renders empty


def test_write_augmented_csv_missing_pmid_yields_empty_cells() -> None:
    parsed = parse_csv("pmid,name\n111,A\n")
    augmented = write_augmented_csv(parsed, records={}, icite_columns=("year", "title"))
    reader = csv.DictReader(io.StringIO(augmented))
    rows = list(reader)
    assert rows[0]["year"] == ""
    assert rows[0]["title"] == ""


def test_write_augmented_csv_preserves_row_order_and_columns() -> None:
    csv_text = "name,pmid,extra\nAlpha,222,x\nBeta,111,y\n"
    parsed = parse_csv(csv_text)
    augmented = write_augmented_csv(parsed, records={}, icite_columns=("year",))
    reader = csv.DictReader(io.StringIO(augmented))
    rows = list(reader)
    assert [r["name"] for r in rows] == ["Alpha", "Beta"]
    assert [r["pmid"] for r in rows] == ["222", "111"]
    assert reader.fieldnames == ["name", "pmid", "extra", "year"]


def test_write_augmented_csv_renders_booleans_lowercase() -> None:
    parsed = parse_csv("pmid\n111\n")
    augmented = write_augmented_csv(parsed, {"111": {"is_clinical": True}}, ("is_clinical",))
    rows = list(csv.DictReader(io.StringIO(augmented)))
    assert rows[0]["is_clinical"] == "true"


def test_iter_valid_pmid_chunks() -> None:
    parsed = parse_csv("pmid\n" + "\n".join(str(i) for i in range(1, 8)) + "\n")
    chunks = list(iter_valid_pmid_chunks(parsed, size=3))
    assert chunks == [["1", "2", "3"], ["4", "5", "6"], ["7"]]


def test_iter_valid_pmid_chunks_rejects_zero_size() -> None:
    parsed = parse_csv("pmid\n111\n")
    with pytest.raises(ValueError):
        list(iter_valid_pmid_chunks(parsed, size=0))
