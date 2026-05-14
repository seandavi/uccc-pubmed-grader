"""End-to-end job processor: parse CSV, query iCite, build augmented CSV + summary."""

from __future__ import annotations

import logging

from uccc_pubmed_grader.csv_io import CSVParseError, parse_csv, write_augmented_csv
from uccc_pubmed_grader.icite import ICITE_COLUMNS, ICiteClient
from uccc_pubmed_grader.jobs import Job, JobStatus, ProgressEvent
from uccc_pubmed_grader.stats import compute_summary

logger = logging.getLogger(__name__)


async def process_job(job: Job, csv_bytes: bytes, *, icite_client: ICiteClient) -> None:
    """Run a job to completion, publishing progress events along the way.

    Terminates the SSE queue regardless of outcome. Sets `job.status` to `done`
    on success or `error` on failure; on success stores `job.csv_bytes` and
    `job.summary`.
    """
    job.status = JobStatus.running
    try:
        await _run(job, csv_bytes, icite_client=icite_client)
    except Exception as exc:  # noqa: BLE001 — top-level handler for a background task
        logger.exception("job %s failed", job.id)
        job.status = JobStatus.error
        job.error_message = str(exc)
        await job.publish(ProgressEvent(phase="error", message=str(exc)))
    finally:
        await job.close()


async def _run(job: Job, csv_bytes: bytes, *, icite_client: ICiteClient) -> None:
    await job.publish(ProgressEvent(phase="parsing"))
    try:
        parsed = parse_csv(csv_bytes, pmid_column=job.pmid_column)
    except CSVParseError as exc:
        job.status = JobStatus.error
        job.error_message = str(exc)
        await job.publish(ProgressEvent(phase="error", message=str(exc)))
        return

    total = len(parsed.valid_pmids)
    await job.publish(ProgressEvent(phase="fetching", processed=0, total=total))

    records: dict[str, dict[str, object]] = {}
    processed = 0
    async with icite_client:
        async for batch in icite_client.fetch_many(parsed.valid_pmids):
            records.update(batch.records)
            processed += len(batch.requested)
            await job.publish(ProgressEvent(phase="fetching", processed=processed, total=total))

    await job.publish(ProgressEvent(phase="summarizing"))
    summary = compute_summary(
        total_rows=parsed.total_rows,
        invalid=len(parsed.invalid_rows),
        requested_pmids=parsed.valid_pmids,
        records=records,
    )
    augmented = write_augmented_csv(parsed, records, ICITE_COLUMNS)

    job.csv_bytes = augmented.encode("utf-8")
    job.summary = summary.to_dict()
    job.status = JobStatus.done

    await job.publish(
        ProgressEvent(
            phase="done",
            processed=processed,
            total=total,
            message=f"matched {summary.matched}/{total}",
        )
    )
