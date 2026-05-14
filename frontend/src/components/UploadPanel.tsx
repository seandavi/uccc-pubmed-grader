import { useCallback, useRef, useState } from "react";

const EXAMPLE_CSV_PATH = "/example-pubmed-grader.csv";
const EXAMPLE_CSV_FILENAME = "example-pubmed-grader.csv";

type Props = {
  pmidColumn: string;
  onPmidColumnChange: (v: string) => void;
  onFile: (file: File) => void;
};

export function UploadPanel({ pmidColumn, onPmidColumnChange, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [exampleError, setExampleError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      onFile(file);
    },
    [onFile],
  );

  const loadExample = useCallback(async () => {
    setLoadingExample(true);
    setExampleError(null);
    try {
      const response = await fetch(EXAMPLE_CSV_PATH);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], EXAMPLE_CSV_FILENAME, { type: "text/csv" });
      onFile(file);
    } catch (err) {
      setExampleError(err instanceof Error ? err.message : "failed to load example");
      setLoadingExample(false);
    }
  }, [onFile]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      handleFile(e.dataTransfer.files?.[0] ?? null);
    },
    [handleFile],
  );

  return (
    <section className="mt-16 grid gap-10 md:grid-cols-[1.05fr_0.95fr] animate-fade-in-up">
      <div>
        <p className="eyebrow">Step 01 · Drop a CSV</p>
        <h2 className="font-display text-display-lg mt-3">A reader for your portfolio.</h2>
        <p className="mt-5 font-sans text-base text-ink2 leading-relaxed max-w-md">
          Any CSV will do, as long as it has a column of PubMed IDs. The default column name is
          <span className="font-mono text-ink"> pmid</span>. Set a different name below if yours
          is something else.
        </p>

        <label className="mt-10 block">
          <span className="eyebrow">PMID column (optional)</span>
          <input
            type="text"
            value={pmidColumn}
            onChange={(e) => onPmidColumnChange(e.target.value)}
            placeholder="pmid"
            className="mt-2 w-full max-w-xs border-b border-ink bg-transparent py-2 font-mono text-sm focus:outline-none focus:border-gold transition-colors"
            aria-label="PMID column name"
          />
        </label>

        <div className="mt-10 rule-top pt-5">
          <p className="eyebrow">No CSV handy?</p>
          <button
            type="button"
            onClick={loadExample}
            disabled={loadingExample}
            className="mt-3 font-display italic text-xl text-ink hover:text-gold2 disabled:text-muted disabled:cursor-progress transition-colors"
          >
            {loadingExample ? "Loading example…" : "Try with example data →"}
          </button>
          <p className="mt-2 font-mono text-[0.7rem] text-muted">
            34-row CSV mixing cancer-research landmarks (Hallmarks, KEYNOTE,
            CAR-T, TCGA) with a tail of lower-impact, obscure papers, spanning
            1993–2019. Includes a deliberately invalid row to show error
            handling.
          </p>
          <p className="mt-3 font-mono text-[0.7rem] text-muted">
            <a
              href={EXAMPLE_CSV_PATH}
              download={EXAMPLE_CSV_FILENAME}
              className="underline underline-offset-4 hover:text-ink"
            >
              Download the example
            </a>{" "}
            to inspect the columns.
          </p>
          {exampleError && (
            <p className="mt-2 font-mono text-[0.7rem] text-oxblood">
              Couldn't load example: {exampleError}
            </p>
          )}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={[
          "relative flex flex-col items-center justify-center min-h-[260px] cursor-pointer",
          "border border-dashed transition-all duration-200",
          drag ? "border-gold bg-gold/10" : "border-ink hover:border-gold",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        aria-label="Upload CSV file"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="hidden"
        />
        <p className="eyebrow text-ink2">Drag a .csv here</p>
        <p className="font-display text-2xl mt-3 italic">or click to browse</p>
        <p className="mt-6 font-mono text-[0.7rem] text-muted">
          Files are read in your browser — nothing is uploaded.
        </p>
        <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-ink" aria-hidden />
        <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-ink" aria-hidden />
        <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-ink" aria-hidden />
        <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-ink" aria-hidden />
      </div>
    </section>
  );
}
