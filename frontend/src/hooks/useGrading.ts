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
import { fetchUnpaywall } from "../lib/unpaywall";
import type { UnpaywallRecord } from "../lib/unpaywall";
import { versionLabel } from "../lib/version";

export type Phase =
  | "idle"
  | "parsing"
  | "fetching"
  | "augmenting"
  | "summarizing"
  | "done"
  | "error";

export type GradingState = {
  phase: Phase;
  processed: number;
  total: number;
  summary: Summary | null;
  records: Map<string, ICiteRecord>;
  unpaywall: Map<string, UnpaywallRecord>;
  requestedPmids: string[];
  totalRows: number;
  invalidCount: number;
  downloadUrl: string | null;
  filename: string;
  error: string | null;
};

const INITIAL: GradingState = {
  phase: "idle",
  processed: 0,
  total: 0,
  summary: null,
  records: new Map(),
  unpaywall: new Map(),
  requestedPmids: [],
  totalRows: 0,
  invalidCount: 0,
  downloadUrl: null,
  filename: "",
  error: null,
};

export function useGrading() {
  const [state, setState] = useState<GradingState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Guard setState against post-unmount calls so an in-flight fetch on a
  // different route can't stomp on the next page's state.
  const safeSetState = useCallback(
    (updater: GradingState | ((s: GradingState) => GradingState)) => {
      if (!mountedRef.current) return;
      setState(updater);
    },
    [],
  );

  useEffect(() => {
    // Reset on setup so React 18 StrictMode's mount → unmount → mount
    // dance leaves us in a "mounted" state again.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    safeSetState(INITIAL);
  }, [safeSetState]);

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
      safeSetState({ ...INITIAL, phase: "parsing", filename: file.name });

      let text: string;
      try {
        text = await file.text();
      } catch (err) {
        const message = err instanceof Error ? err.message : "failed to read file";
        track("processing_error", { phase: "read", error_message: message });
        safeSetState((s) => ({ ...s, phase: "error", error: message }));
        return;
      }

      let parsed;
      try {
        parsed = parseCSV(text, pmidColumnOverride?.trim() || undefined);
      } catch (err) {
        const message = err instanceof Error ? err.message : "failed to parse CSV";
        track("processing_error", {
          phase: "parse",
          error_code: err instanceof CSVParseError ? "csv_parse_error" : "unknown",
          error_message: message,
        });
        safeSetState((s) => ({ ...s, phase: "error", error: message }));
        return;
      }

      const pmids = validPmids(parsed);
      safeSetState((s) => ({
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
          safeSetState((s) => ({ ...s, processed }));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "iCite fetch failed";
        track("processing_error", { phase: "fetch", error_message: message });
        safeSetState((s) => ({ ...s, phase: "error", error: message }));
        return;
      }

      // --- Augmentation phase: Unpaywall (by DOI)
      const doiByPmid = new Map<string, string>();
      const dois: string[] = [];
      for (const pmid of pmids) {
        const rec = records.get(pmid);
        const doi = rec?.doi?.trim();
        if (doi) {
          doiByPmid.set(pmid, doi);
          dois.push(doi);
        }
      }

      safeSetState((s) => ({
        ...s,
        phase: "augmenting",
        processed: 0,
        total: dois.length,
      }));

      let unpaywall = new Map<string, UnpaywallRecord>();
      try {
        unpaywall = await fetchUnpaywall(dois, {
          signal: controller.signal,
          onProgress: (p) => {
            safeSetState((s) => ({ ...s, processed: p }));
          },
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Non-fatal: augmentation failures should not abort the dashboard.
        // Log and continue with whatever we got.
        // eslint-disable-next-line no-console
        console.warn("augmentation failed", err);
        track("processing_error", {
          phase: "augment",
          error_message: err instanceof Error ? err.message : String(err),
        });
      }

      safeSetState((s) => ({ ...s, phase: "summarizing" }));
      const summary = computeSummary({
        totalRows: parsed.rows.length,
        invalid: parsed.invalidRows.length,
        requestedPmids: pmids,
        records,
        unpaywallByDoi: unpaywall,
        doiByPmid,
      });
      const augmented = writeAugmentedCSV(parsed, records, ICITE_COLUMNS, {
        appVersion: versionLabel(),
        dateRun: new Date().toISOString(),
        unpaywallByDoi: unpaywall,
      });
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

      safeSetState({
        phase: "done",
        processed: pmids.length,
        total: pmids.length,
        records,
        unpaywall,
        requestedPmids: pmids,
        totalRows: parsed.rows.length,
        invalidCount: parsed.invalidRows.length,
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
