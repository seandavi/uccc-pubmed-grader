"""CSV input handling: detect PMID column, validate, prepare for augmentation."""

from __future__ import annotations

import csv
import io
import re
from collections.abc import Iterator
from dataclasses import dataclass, field

PMID_PATTERN = re.compile(r"^\d{1,9}$")
DEFAULT_PMID_COLUMN = "pmid"


class CSVParseError(ValueError):
    """Raised when the uploaded CSV cannot be parsed."""


@dataclass(slots=True)
class ParsedCSV:
    """Result of parsing the uploaded CSV.

    Rows preserve original order and original columns. `pmid_column` is the
    actual header name used in the source file (preserving case). `valid_pmids`
    is the de-duplicated set of valid PMIDs to query.
    """

    fieldnames: list[str]
    pmid_column: str
    rows: list[dict[str, str]]
    invalid_rows: list[tuple[int, str]] = field(default_factory=list)

    @property
    def valid_pmids(self) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for row in self.rows:
            value = (row.get(self.pmid_column) or "").strip()
            if PMID_PATTERN.fullmatch(value) and value not in seen:
                seen.add(value)
                out.append(value)
        return out

    @property
    def total_rows(self) -> int:
        return len(self.rows)


def _resolve_pmid_column(fieldnames: list[str], requested: str | None) -> str:
    """Find the actual header in `fieldnames` matching `requested` (case-insensitive).

    If `requested` is None, defaults to `pmid`.
    """
    target = (requested or DEFAULT_PMID_COLUMN).strip().lower()
    if not target:
        raise CSVParseError("PMID column name cannot be empty")
    for name in fieldnames:
        if name.strip().lower() == target:
            return name
    raise CSVParseError(
        f"PMID column {requested or DEFAULT_PMID_COLUMN!r} not found in CSV "
        f"(headers: {fieldnames!r})"
    )


def parse_csv(content: bytes | str, *, pmid_column: str | None = None) -> ParsedCSV:
    """Parse CSV bytes/text and identify the PMID column.

    Invalid PMIDs are recorded with their 1-indexed row number but rows are kept
    in the output (so the augmented CSV mirrors the input shape).
    """
    text = content.decode("utf-8-sig") if isinstance(content, bytes) else content
    if not text.strip():
        raise CSVParseError("CSV is empty")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise CSVParseError("CSV has no header row")

    fieldnames = list(reader.fieldnames)
    resolved = _resolve_pmid_column(fieldnames, pmid_column)

    rows: list[dict[str, str]] = []
    invalid: list[tuple[int, str]] = []
    for idx, row in enumerate(reader, start=1):
        # csv.DictReader can produce None values for short rows; normalize to ""
        clean = {k: (v if v is not None else "") for k, v in row.items()}
        rows.append(clean)
        value = (clean.get(resolved) or "").strip()
        if not PMID_PATTERN.fullmatch(value):
            invalid.append((idx, value))

    return ParsedCSV(
        fieldnames=fieldnames,
        pmid_column=resolved,
        rows=rows,
        invalid_rows=invalid,
    )


def _format_value(value: object) -> str:
    """Render an iCite field as a CSV cell."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def write_augmented_csv(
    parsed: ParsedCSV,
    records: dict[str, dict[str, object]],
    icite_columns: tuple[str, ...],
) -> str:
    """Return the CSV text of original rows with iCite columns appended."""
    fieldnames = list(parsed.fieldnames) + list(icite_columns)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in parsed.rows:
        pmid = (row.get(parsed.pmid_column) or "").strip()
        record = records.get(pmid, {})
        augmented = dict(row)
        for col in icite_columns:
            augmented[col] = _format_value(record.get(col))
        writer.writerow(augmented)
    return buffer.getvalue()


def iter_valid_pmid_chunks(parsed: ParsedCSV, size: int) -> Iterator[list[str]]:
    """Yield chunks of valid PMIDs of length `size` (final chunk may be smaller)."""
    if size < 1:
        raise ValueError("size must be >= 1")
    chunk: list[str] = []
    for pmid in parsed.valid_pmids:
        chunk.append(pmid)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk
