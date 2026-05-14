import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  info?: string;
  emphasized?: boolean;
};

export function StatCard({ label, value, unit, hint, info, emphasized = false }: Props) {
  return (
    <article
      className={[
        "relative p-6 border border-rule bg-paper2/40",
        emphasized ? "border-ink bg-gold/10" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {info && <InfoTooltip label={label} text={info} />}
      </div>
      <p className="mt-4 font-display text-stat-xl text-ink tabular leading-none">
        {value}
        {unit && <span className="font-display text-xl text-ink2 ml-1">{unit}</span>}
      </p>
      {hint && <p className="mt-3 font-mono text-[0.7rem] text-muted tabular">{hint}</p>}
    </article>
  );
}

function InfoTooltip({ label, text }: { label: string; text: string }) {
  return (
    <span className="relative group inline-flex items-center print-hide shrink-0">
      <span
        tabIndex={0}
        role="img"
        aria-label={`About ${label}: ${text}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink2/40 font-mono text-[0.6rem] text-ink2 cursor-help select-none transition-colors hover:border-ink hover:text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute top-full right-0 z-20 mt-2 w-56 bg-ink text-paper text-[0.72rem] font-sans leading-snug px-3 py-2 shadow-lg"
      >
        {text}
      </span>
    </span>
  );
}
