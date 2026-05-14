import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ICiteRecord } from "../lib/icite";
import { computeSummary } from "../lib/stats";
import type { Summary } from "../lib/stats";

import { RuleHeading } from "./RuleHeading";
import { StatCard } from "./StatCard";
import { YearRangeFilter } from "./YearRangeFilter";

type Props = {
  summary: Summary;
  records: Map<string, ICiteRecord>;
  requestedPmids: string[];
  totalRows: number;
  invalidCount: number;
  downloadUrl: string;
  filename: string;
  onDownloadClick: () => void;
  onReset: () => void;
};

const TICK_FONT = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 11,
  fill: "#1C1B17",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#0A0A09",
  border: "none",
  color: "#FAF7F2",
  fontFamily: "DM Sans, sans-serif",
  fontSize: 12,
  padding: "8px 12px",
};

function fmtPct(v: number | null): string {
  return v === null ? "—" : `${v}`;
}

function fmtNumber(v: number | null): string {
  return v === null ? "—" : v.toLocaleString();
}

function yearOf(r: ICiteRecord): number | null {
  if (r.year === undefined || r.year === null) return null;
  const n = typeof r.year === "number" ? r.year : Number(r.year);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function Dashboard({
  summary: initialSummary,
  records,
  requestedPmids,
  totalRows,
  invalidCount,
  downloadUrl,
  filename,
  onDownloadClick,
  onReset,
}: Props) {
  // The full year range available in the matched records.
  const [minYear, maxYear] = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const rec of records.values()) {
      const y = yearOf(rec);
      if (y === null) continue;
      if (y < min) min = y;
      if (y > max) max = y;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return [0, 0] as const;
    }
    return [min, max] as const;
  }, [records]);

  const [yearRange, setYearRange] = useState<[number, number]>(() => [minYear, maxYear]);
  const [from, to] = yearRange;
  const isFiltered = from > minYear || to < maxYear;

  // Recompute summary on filter change. When unfiltered we keep the initial
  // summary to skip the work entirely.
  const summary: Summary = useMemo(() => {
    if (!isFiltered) return initialSummary;
    const keep = new Set<string>();
    const filtered = new Map<string, ICiteRecord>();
    for (const pmid of requestedPmids) {
      const rec = records.get(pmid);
      if (!rec) continue;
      const y = yearOf(rec);
      if (y !== null && y >= from && y <= to) {
        keep.add(pmid);
        filtered.set(pmid, rec);
      }
    }
    return computeSummary({
      totalRows,
      invalid: invalidCount,
      requestedPmids: requestedPmids.filter((p) => keep.has(p)),
      records: filtered,
    });
  }, [from, to, isFiltered, initialSummary, records, requestedPmids, totalRows, invalidCount]);

  const rcrAbove1 = summary.rcr.above1Pct;

  return (
    <section className="mt-16 space-y-16 animate-fade-in-up">
      {/* Headline */}
      <div className="rule-bottom pb-10">
        <p className="eyebrow">Step 03 · Issue</p>
        <h2 className="font-display text-display-lg mt-3 leading-tight">
          {summary.matched.toLocaleString()} papers, read.
        </h2>
        <p className="mt-5 max-w-2xl font-sans text-base text-ink2 leading-relaxed">
          Of <span className="tabular">{summary.totalRows.toLocaleString()}</span> rows submitted,
          iCite returned metrics for{" "}
          <span className="font-mono text-ink tabular">{summary.matched.toLocaleString()}</span>.
          {summary.missing > 0 && (
            <>
              {" "}
              <span className="tabular">{summary.missing}</span> PMIDs were not found.
            </>
          )}
          {summary.invalid > 0 && (
            <>
              {" "}
              <span className="tabular">{summary.invalid}</span> rows had invalid PMIDs.
            </>
          )}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3 print-hide">
          <a
            href={downloadUrl}
            download={filename}
            onClick={onDownloadClick}
            className="inline-flex items-center gap-3 bg-ink text-paper px-6 py-3 font-mono text-xs uppercase tracking-eyebrow hover:bg-gold hover:text-ink transition-colors"
          >
            <span>Download augmented CSV</span>
            <span aria-hidden>↓</span>
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-3 border border-ink px-6 py-3 font-mono text-xs uppercase tracking-eyebrow hover:bg-ink hover:text-paper transition-colors"
          >
            <span>Print / save PDF</span>
            <span aria-hidden>🖶</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[0.7rem] uppercase tracking-eyebrow text-ink2 hover:text-ink transition-colors px-2"
          >
            Start over
          </button>
        </div>
      </div>

      {/* Year filter — only when there's more than a single year's worth of data */}
      {maxYear > minYear && (
        <div className="print-hide">
          <YearRangeFilter
            minYear={minYear}
            maxYear={maxYear}
            value={yearRange}
            onChange={setYearRange}
            histogram={initialSummary.yearHistogram}
          />
          {isFiltered && (
            <p className="mt-3 font-mono text-[0.7rem] text-muted tabular">
              Showing {summary.matched.toLocaleString()} of{" "}
              {initialSummary.matched.toLocaleString()} matched papers
              ({from}–{to}).
            </p>
          )}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4 [&>*]:bg-paper">
        <StatCard
          label="Median RCR"
          value={fmtNumber(summary.rcr.median)}
          hint={summary.rcr.mean !== null ? `mean ${summary.rcr.mean}` : undefined}
          emphasized
        />
        <StatCard
          label="Above NIH baseline"
          value={fmtPct(rcrAbove1)}
          unit="%"
          hint={summary.rcr.above2Pct !== null ? `${summary.rcr.above2Pct}% above 2×` : undefined}
        />
        <StatCard
          label="Clinical"
          value={fmtPct(summary.pctClinical)}
          unit="%"
        />
        <StatCard
          label="Translation potential"
          value={fmtPct(summary.pctHasTranslationPotential)}
          unit="%"
          hint="iCite APT ≥ 0.5"
        />
      </div>

      {/* RCR distribution */}
      <div>
        <RuleHeading
          eyebrow="Figure I"
          title="Relative Citation Ratio, by bucket"
        />
        <p className="mt-3 font-sans text-sm text-ink2 max-w-xl">
          NIH RCR normalizes citation count to field. A value of 1 is the NIH median; above 2 is
          considered high impact. Each bar counts papers in that range.
        </p>
        <div className="mt-8 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={summary.rcr.histogram}
              margin={{ top: 10, right: 24, left: 0, bottom: 24 }}
            >
              <CartesianGrid stroke="#D9D3C5" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={TICK_FONT} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={TICK_FONT} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(207,184,124,0.15)" }} />
              <Bar dataKey="count" fill="#0A0A09" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Year histogram */}
      <div>
        <RuleHeading eyebrow="Figure II" title="Publications by year" />
        <div className="mt-8 h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={summary.yearHistogram}
              margin={{ top: 10, right: 24, left: 0, bottom: 24 }}
            >
              <CartesianGrid stroke="#D9D3C5" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={TICK_FONT} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={TICK_FONT} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(207,184,124,0.15)" }} />
              <Bar dataKey="count" fill="#CFB87C" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top journals + Top cited */}
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <RuleHeading eyebrow="Table I" title="Top journals" />
          {summary.topJournals.length === 0 ? (
            <p className="mt-6 font-sans text-sm text-muted italic">No journal data.</p>
          ) : (
            <ol className="mt-8 space-y-3">
              {summary.topJournals.map((j, i) => (
                <li
                  key={`${j.journal}-${i}`}
                  className="flex items-baseline justify-between gap-4 border-b hairline pb-2"
                >
                  <span className="flex items-baseline gap-3 min-w-0">
                    <span className="font-mono text-[0.7rem] text-muted tabular">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-base truncate" title={j.journal}>
                      {j.journal}
                    </span>
                  </span>
                  <span className="font-mono text-sm tabular text-ink">
                    {j.count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <RuleHeading eyebrow="Table II" title="Top-cited papers" />
          {summary.topCitedPapers.length === 0 ? (
            <p className="mt-6 font-sans text-sm text-muted italic">No paper data.</p>
          ) : (
            <ol className="mt-8 space-y-5">
              {summary.topCitedPapers.map((p, i) => (
                <li key={p.pmid} className="border-b hairline pb-4">
                  <p className="flex items-baseline gap-3 font-mono text-[0.7rem] text-muted tabular">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      {p.journal}
                      {p.year && <> · {p.year}</>}
                    </span>
                  </p>
                  <h4 className="mt-1 font-display text-base leading-snug text-ink">
                    {p.title || "Untitled"}
                  </h4>
                  <div className="mt-2 flex items-baseline gap-6 font-mono text-xs">
                    <span className="tabular">
                      <span className="text-muted">cites </span>
                      <span className="text-ink">{fmtNumber(p.citationCount)}</span>
                    </span>
                    <span className="tabular">
                      <span className="text-muted">RCR </span>
                      <span className="text-ink">{fmtNumber(p.relativeCitationRatio)}</span>
                    </span>
                    <a
                      className="ml-auto text-ink2 hover:text-ink underline-offset-4 hover:underline"
                      href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PMID {p.pmid} ↗
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Footer rule */}
      <div className="rule-top pt-6">
        <p className="eyebrow text-muted">
          End of issue · Data via NIH iCite. Computed in your browser.
        </p>
      </div>
    </section>
  );
}
