/**
 * The main "grader" page — upload → progress → dashboard. Pulled out of
 * App so it slots in as a route.
 */

import { useState } from "react";

import { Dashboard } from "../components/Dashboard";
import { ProgressPanel } from "../components/ProgressPanel";
import { UploadPanel } from "../components/UploadPanel";
import { useGrading } from "../hooks/useGrading";

export function Grader() {
  const { state, start, reset, trackDownload } = useGrading();
  const [pmidColumn, setPmidColumn] = useState("");

  const onFile = (file: File) => {
    void start(file, pmidColumn || undefined);
  };

  if (state.phase === "idle") {
    return (
      <UploadPanel
        pmidColumn={pmidColumn}
        onPmidColumnChange={setPmidColumn}
        onFile={onFile}
      />
    );
  }

  if (state.phase === "parsing" || state.phase === "fetching" || state.phase === "summarizing") {
    return (
      <ProgressPanel
        phase={state.phase}
        processed={state.processed}
        total={state.total}
        filename={state.filename}
        onCancel={reset}
      />
    );
  }

  if (state.phase === "error") {
    return (
      <div className="mt-16 max-w-2xl border-l-2 border-oxblood pl-6 animate-fade-in-up">
        <p className="eyebrow text-oxblood">Error</p>
        <h2 className="font-display text-display-lg mt-3 text-ink">
          {state.error ?? "Something went wrong."}
        </h2>
        <button
          type="button"
          onClick={reset}
          className="mt-8 border border-ink px-5 py-2.5 font-mono text-xs uppercase tracking-eyebrow hover:bg-ink hover:text-paper transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.phase === "done" && state.summary && state.downloadUrl) {
    return (
      <Dashboard
        summary={state.summary}
        records={state.records}
        unpaywall={state.unpaywall}
        requestedPmids={state.requestedPmids}
        totalRows={state.totalRows}
        invalidCount={state.invalidCount}
        downloadUrl={state.downloadUrl}
        filename={state.filename}
        onDownloadClick={trackDownload}
        onReset={reset}
      />
    );
  }

  return null;
}
