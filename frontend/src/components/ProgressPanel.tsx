import type { Phase } from "../hooks/useGrading";

type Props = {
  phase: Phase;
  processed: number;
  total: number;
  filename: string;
  onCancel: () => void;
};

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  parsing: "Reading CSV",
  fetching: "Consulting iCite",
  summarizing: "Drawing dashboard",
  done: "Complete",
  error: "Halted",
};

export function ProgressPanel({ phase, processed, total, filename, onCancel }: Props) {
  // When `total` is 0 we don't have a meaningful percentage yet (e.g. mid-parse,
  // or the CSV contained no valid PMIDs). Use an indeterminate sliver during
  // parsing; afterwards show 0 so the bar doesn't lie.
  const pct =
    total > 0
      ? Math.min(100, Math.round((processed / total) * 100))
      : phase === "parsing"
        ? 5
        : 0;
  const showCounter = total > 0;

  return (
    <section className="mt-16 max-w-3xl animate-fade-in-up">
      <p className="eyebrow">Step 02 · In press</p>
      <h2 className="font-display text-display-lg mt-3 leading-tight">
        {PHASE_LABEL[phase]}
        <span className="animate-press-tick text-gold">.</span>
      </h2>
      <p className="mt-3 font-mono text-xs text-ink2 tabular">
        {filename}
      </p>

      <div className="mt-10 rule-top pt-6">
        <div className="flex items-baseline justify-between font-mono text-xs">
          <span className="eyebrow">Progress</span>
          <span className="tabular text-ink">
            {showCounter ? (
              <>
                {processed.toLocaleString()}
                <span className="text-muted"> / </span>
                {total.toLocaleString()} PMIDs · {pct}%
              </>
            ) : (
              <span className="text-muted">working…</span>
            )}
          </span>
        </div>
        <div className="mt-3 h-[3px] w-full bg-rule overflow-hidden">
          <div
            className="h-full bg-ink transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-10 font-mono text-[0.7rem] uppercase tracking-eyebrow text-ink2 hover:text-oxblood transition-colors"
      >
        ← Cancel and start over
      </button>
    </section>
  );
}
