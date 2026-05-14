import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  emphasized?: boolean;
};

export function StatCard({ label, value, unit, hint, emphasized = false }: Props) {
  return (
    <article
      className={[
        "p-6 border border-rule bg-paper2/40",
        emphasized ? "border-ink bg-gold/10" : "",
      ].join(" ")}
    >
      <p className="eyebrow">{label}</p>
      <p className="mt-4 font-display text-stat-xl text-ink tabular leading-none">
        {value}
        {unit && <span className="font-display text-xl text-ink2 ml-1">{unit}</span>}
      </p>
      {hint && <p className="mt-3 font-mono text-[0.7rem] text-muted tabular">{hint}</p>}
    </article>
  );
}
