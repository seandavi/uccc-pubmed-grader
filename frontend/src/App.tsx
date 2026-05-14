import { useState } from "react";

import { Dashboard } from "./components/Dashboard";
import { Header } from "./components/Header";
import { ProgressPanel } from "./components/ProgressPanel";
import { UploadPanel } from "./components/UploadPanel";
import { useGrading } from "./hooks/useGrading";

export default function App() {
  const { state, start, reset, trackDownload } = useGrading();
  const [pmidColumn, setPmidColumn] = useState("");

  const onFile = (file: File) => {
    void start(file, pmidColumn || undefined);
  };

  return (
    <div className="paper-grain relative min-h-screen text-ink">
      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-10">
        <Header />

        {state.phase === "idle" && (
          <UploadPanel
            pmidColumn={pmidColumn}
            onPmidColumnChange={setPmidColumn}
            onFile={onFile}
          />
        )}

        {(state.phase === "parsing" ||
          state.phase === "fetching" ||
          state.phase === "summarizing") && (
          <ProgressPanel
            phase={state.phase}
            processed={state.processed}
            total={state.total}
            filename={state.filename}
            onCancel={reset}
          />
        )}

        {state.phase === "error" && (
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
        )}

        {state.phase === "done" && state.summary && state.downloadUrl && (
          <Dashboard
            summary={state.summary}
            downloadUrl={state.downloadUrl}
            filename={state.filename}
            onDownloadClick={trackDownload}
            onReset={reset}
          />
        )}
      </div>
    </div>
  );
}
