/**
 * Orchestrates the full grading flow: parse CSV → fetch iCite in batches →
 * compute summary → produce a downloadable Blob URL.
 *
 * Exposes `phase`, `progress`, `summary`, and an error so the UI can render
 * the three states (idle / running / done) and tick a progress bar.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { CSVParseError, parseCSV, validPmids, writeAugmentedCSV } from "../lib/csv";
import { ICITE_COLUMNS, fetchMany } from "../lib/icite";
import type { ICiteRecord } from "../lib/icite";
import { computeSummary } from "../lib/stats";
import type { Summary } from "../lib/stats";
import { track } from "../lib/analytics";

export type Phase = "idle" | "parsing" | "fetching" | "summarizing" | "done" | "error";

export type GradingState = {
  phase: Phase;
  processed: number;
  total: number;
  summary: Summary | null;
  downloadUrl: string | null;
  filename: string;
  error: string | null;
};

const INITIAL: GradingState = {
  phase: "idle",
  processed: 0,
  total: 0,
  summary: null,
  downloadUrl: null,
  filename: "",
  error: null,
};

export function useGrading() {
  const [state, setState] = useState<GradingState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setState(INITIAL);
  }, []);

  const start = useCallback(
    async (file: File, pmidColumnOverride: string | undefined) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const started = performance.now();

      track("upload_started", {
        file_size_bytes: file.size,
        has_column_override: Boolean(pmidColumnOverride),
      });

      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setState({ ...INITIAL, phase: "parsing", filename: file.name });

      let text: string;
      try {
        text = await file.text();
      } catch (err) {
        const message = err instanceof Error ? err.message : "failed to read file";
        track("processing_error", { phase: "read", message });
        setState((s) => ({ ...s, phase: "error", error: message }));
        return;
      }

      let parsed;
      try {
        parsed = parseCSV(text, pmidColumnOverride?.trim() || undefined);
      } catch (err) {
        const message = err instanceof Error ? err.message : "failed to parse CSV";
        track("processing_error", {
          phase: "parse",
          message: err instanceof CSVParseError ? "csv_parse_error" : "unknown",
        });
        setState((s) => ({ ...s, phase: "error", error: message }));
        return;
      }

      const pmids = validPmids(parsed);
      setState((s) => ({
        ...s,
        phase: "fetching",
        processed: 0,
        total: pmids.length,
      }));

      const records = new Map<string, ICiteRecord>();
      let processed = 0;
      try {
        for await (const batch of fetchMany(pmids, { signal: controller.signal })) {
          for (const [k, v] of batch.records) records.set(k, v);
          processed += batch.requested.length;
          setState((s) => ({ ...s, processed }));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "iCite fetch failed";
        track("processing_error", { phase: "fetch", message });
        setState((s) => ({ ...s, phase: "error", error: message }));
        return;
      }

      setState((s) => ({ ...s, phase: "summarizing" }));
      const summary = computeSummary({
        totalRows: parsed.rows.length,
        invalid: parsed.invalidRows.length,
        requestedPmids: pmids,
        records,
      });
      const augmented = writeAugmentedCSV(parsed, records, ICITE_COLUMNS);
      const blob = new Blob([augmented], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const outputName = file.name.replace(/\.csv$/i, "") + ".graded.csv";

      const durationMs = Math.round(performance.now() - started);
      track("processing_complete", {
        duration_ms: durationMs,
        total: pmids.length,
        matched: summary.matched,
        missing: summary.missing,
        invalid: summary.invalid,
      });

      setState({
        phase: "done",
        processed: pmids.length,
        total: pmids.length,
        summary,
        downloadUrl: url,
        filename: outputName,
        error: null,
      });
    },
    [],
  );

  const trackDownload = useCallback(() => {
    track("result_downloaded", { filename: state.filename });
  }, [state.filename]);

  return { state, start, reset, trackDownload };
}
