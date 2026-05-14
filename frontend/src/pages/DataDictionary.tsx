/**
 * Data dictionary page — every column the app appends, with a short
 * description and a type tag. Source of truth is `lib/columnDictionary.ts`.
 */

import { Link } from "react-router-dom";

import { COLUMN_DICTIONARY } from "../lib/columnDictionary";
import type { ColumnDoc } from "../lib/columnDictionary";

function SourcePill({ source }: { source: ColumnDoc["source"] }) {
  const styles =
    source === "iCite"
      ? "bg-ink text-paper"
      : "bg-gold/20 text-ink border border-gold";
  return (
    <span
      className={`inline-block px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-eyebrow ${styles}`}
    >
      {source}
    </span>
  );
}

export function DataDictionary() {
  const grouped = {
    iCite: COLUMN_DICTIONARY.filter((c) => c.source === "iCite"),
    App: COLUMN_DICTIONARY.filter((c) => c.source === "App"),
  };

  return (
    <article className="mt-12 space-y-12 animate-fade-in-up">
      <header className="rule-bottom pb-8">
        <p className="eyebrow">Appendix · Data dictionary</p>
        <h1 className="font-display text-display-lg mt-3 leading-tight">
          What every column in the augmented CSV means.
        </h1>
        <p className="mt-5 max-w-2xl font-sans text-base text-ink2 leading-relaxed">
          The downloaded CSV preserves your original columns and appends the columns below.
          When an iCite column name collides with one of your own (for example, you already
          have a <code className="font-mono text-sm">year</code> column), the iCite version
          is renamed with an <code className="font-mono text-sm">icite_</code> prefix so your
          data is preserved unchanged.
        </p>
      </header>

      <Section title="From NIH iCite" docs={grouped.iCite} />
      <Section title="Added by this app" docs={grouped.App} />

      <div className="rule-top pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-eyebrow text-ink2 hover:text-ink transition-colors"
        >
          <span>←</span>
          <span>Back to the upload page</span>
        </Link>
      </div>
    </article>
  );
}

function Section({ title, docs }: { title: string; docs: readonly ColumnDoc[] }) {
  return (
    <section className="rule-top pt-6">
      <h2 className="font-display text-2xl sm:text-3xl">{title}</h2>
      <dl className="mt-6 divide-y divide-rule">
        {docs.map((c) => (
          <div
            key={c.name}
            className="grid gap-3 py-4 sm:grid-cols-[1.3fr_0.7fr_2.5fr] sm:gap-6 sm:items-baseline"
          >
            <dt className="font-mono text-sm text-ink tabular break-all">{c.name}</dt>
            <div className="flex items-center gap-2 text-[0.7rem]">
              <SourcePill source={c.source} />
              <span className="font-mono uppercase tracking-eyebrow text-muted">{c.type}</span>
            </div>
            <dd className="font-sans text-sm text-ink2 leading-relaxed">{c.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
