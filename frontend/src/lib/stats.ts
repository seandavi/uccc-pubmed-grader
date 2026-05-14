/**
 * Summary statistics over a set of iCite records — drives the dashboard.
 *
 * Note on "% NIH-funded": iCite's /api/pubs does not expose grant attribution,
 * so we report `pctWithRcr` (papers iCite was able to score with an RCR), the
 * closest available proxy.
 */

import type { ICiteRecord } from "./icite";

export const RCR_BUCKET_EDGES: readonly number[] = [0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0];

export type HistogramBucket = { label: string; count: number };
export type JournalCount = { journal: string; count: number };
export type TopPaper = {
  pmid: string;
  title: string;
  journal: string;
  year: number | null;
  citationCount: number | null;
  relativeCitationRatio: number | null;
};

export type Summary = {
  totalRows: number;
  matched: number;
  missing: number;
  invalid: number;
  rcr: {
    mean: number | null;
    median: number | null;
    above1Pct: number | null;
    above2Pct: number | null;
    histogram: HistogramBucket[];
  };
  yearHistogram: HistogramBucket[];
  topJournals: JournalCount[];
  pctWithRcr: number | null;
  pctClinical: number | null;
  pctAnimal: number | null;
  pctHasTranslationPotential: number | null;
  topCitedPapers: TopPaper[];
};

function asFloat(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const f = typeof v === "number" ? v : Number(v);
  return Number.isFinite(f) ? f : null;
}

function asInt(v: unknown): number | null {
  const f = asFloat(v);
  return f === null ? null : Math.trunc(f);
}

function asBool(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return ["1", "true", "yes", "y"].includes(v.trim().toLowerCase());
  return null;
}

function pctOf(num: number, denom: number): number | null {
  if (denom <= 0) return null;
  return Math.round(((100 * num) / denom) * 100) / 100;
}

function mean(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2];
}

function rcrBucketLabels(): string[] {
  return RCR_BUCKET_EDGES.map((edge, i) =>
    i + 1 < RCR_BUCKET_EDGES.length ? `${edge}–${RCR_BUCKET_EDGES[i + 1]}` : `${edge}+`,
  );
}

function bucketRcr(values: readonly number[]): HistogramBucket[] {
  const labels = rcrBucketLabels();
  const counts = labels.map(() => 0);
  for (const v of values) {
    let placed = false;
    for (let i = 0; i < RCR_BUCKET_EDGES.length - 1; i += 1) {
      if (v >= RCR_BUCKET_EDGES[i] && v < RCR_BUCKET_EDGES[i + 1]) {
        counts[i] += 1;
        placed = true;
        break;
      }
    }
    if (!placed) counts[counts.length - 1] += 1;
  }
  return labels.map((label, i) => ({ label, count: counts[i] }));
}

export type ComputeArgs = {
  totalRows: number;
  invalid: number;
  requestedPmids: readonly string[];
  records: Map<string, ICiteRecord>;
  topNPapers?: number;
  topNJournals?: number;
};

export function computeSummary(args: ComputeArgs): Summary {
  const topNPapers = args.topNPapers ?? 10;
  const topNJournals = args.topNJournals ?? 10;
  const matchedRecords: ICiteRecord[] = [];
  let matched = 0;
  for (const pmid of args.requestedPmids) {
    const rec = args.records.get(pmid);
    if (rec) {
      matchedRecords.push(rec);
      matched += 1;
    }
  }
  const missing = args.requestedPmids.length - matched;

  // RCR
  const rcrValues: number[] = [];
  for (const r of matchedRecords) {
    const v = asFloat(r.relative_citation_ratio);
    if (v !== null) rcrValues.push(v);
  }
  const rcrMean = rcrValues.length ? Math.round(mean(rcrValues) * 1000) / 1000 : null;
  const rcrMedian = rcrValues.length ? Math.round(median(rcrValues) * 1000) / 1000 : null;
  const rcrAbove1 = rcrValues.filter((v) => v > 1).length;
  const rcrAbove2 = rcrValues.filter((v) => v > 2).length;

  // Year histogram
  const yearCount = new Map<number, number>();
  for (const r of matchedRecords) {
    const y = asInt(r.year);
    if (y !== null) yearCount.set(y, (yearCount.get(y) ?? 0) + 1);
  }
  const yearHistogram: HistogramBucket[] = [...yearCount.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, count]) => ({ label: String(year), count }));

  // Journals
  const journalCount = new Map<string, number>();
  for (const r of matchedRecords) {
    const j = (r.journal ?? "").trim();
    if (j) journalCount.set(j, (journalCount.get(j) ?? 0) + 1);
  }
  const topJournals: JournalCount[] = [...journalCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topNJournals)
    .map(([journal, count]) => ({ journal, count }));

  // Classifications
  const countBool = (predicate: (r: ICiteRecord) => boolean | null) =>
    matchedRecords.filter((r) => predicate(r) === true).length;
  const countAnimal = () =>
    matchedRecords.filter((r) => {
      const v = asFloat(r.animal);
      return v !== null && v > 0.5;
    }).length;
  const countTranslation = () =>
    matchedRecords.filter((r) => {
      const v = asFloat(r.apt);
      return v !== null && v >= 0.5;
    }).length;
  const countWithRcr = () =>
    matchedRecords.filter((r) => asFloat(r.relative_citation_ratio) !== null).length;

  // Top cited
  const topCitedPapers: TopPaper[] = [...matchedRecords]
    .sort((a, b) => (asInt(b.citation_count) ?? -1) - (asInt(a.citation_count) ?? -1))
    .slice(0, topNPapers)
    .map((r) => ({
      pmid: String(r.pmid ?? ""),
      title: r.title ?? "",
      journal: r.journal ?? "",
      year: asInt(r.year),
      citationCount: asInt(r.citation_count),
      relativeCitationRatio: asFloat(r.relative_citation_ratio),
    }));

  return {
    totalRows: args.totalRows,
    matched,
    missing,
    invalid: args.invalid,
    rcr: {
      mean: rcrMean,
      median: rcrMedian,
      above1Pct: pctOf(rcrAbove1, rcrValues.length),
      above2Pct: pctOf(rcrAbove2, rcrValues.length),
      histogram: bucketRcr(rcrValues),
    },
    yearHistogram,
    topJournals,
    pctWithRcr: pctOf(countWithRcr(), matchedRecords.length),
    pctClinical: pctOf(countBool((r) => asBool(r.is_clinical)), matchedRecords.length),
    pctAnimal: pctOf(countAnimal(), matchedRecords.length),
    pctHasTranslationPotential: pctOf(countTranslation(), matchedRecords.length),
    topCitedPapers,
  };
}
