import { describe, expect, it } from "vitest";

import type { ICiteRecord } from "../icite";
import { computeSummary } from "../stats";

function rec(p: number, extra: Partial<ICiteRecord> = {}): ICiteRecord {
  return {
    pmid: p,
    year: 2021,
    title: `Paper ${p}`,
    journal: "Nature",
    relative_citation_ratio: 1.5,
    citation_count: 10,
    is_clinical: false,
    animal: 0,
    apt: 0.5,
    ...extra,
  };
}

describe("computeSummary", () => {
  it("counts matched, missing, invalid", () => {
    const records = new Map([
      ["111", rec(111)],
      ["222", rec(222)],
    ]);
    const s = computeSummary({
      totalRows: 4,
      invalid: 1,
      requestedPmids: ["111", "222", "333"],
      records,
    });
    expect(s.matched).toBe(2);
    expect(s.missing).toBe(1);
    expect(s.invalid).toBe(1);
    expect(s.totalRows).toBe(4);
  });

  it("RCR thresholds", () => {
    const records = new Map([
      ["1", rec(1, { relative_citation_ratio: 0.5 })],
      ["2", rec(2, { relative_citation_ratio: 1.5 })],
      ["3", rec(3, { relative_citation_ratio: 2.5 })],
      ["4", rec(4, { relative_citation_ratio: 4.0 })],
    ]);
    const s = computeSummary({
      totalRows: 4,
      invalid: 0,
      requestedPmids: [...records.keys()],
      records,
    });
    expect(s.rcr.mean).toBe(2.125);
    expect(s.rcr.median).toBe(2.0);
    expect(s.rcr.above1Pct).toBe(75);
    expect(s.rcr.above2Pct).toBe(50);
  });

  it("RCR histogram puts values into expected buckets", () => {
    const rcrs = [0.1, 0.6, 1.2, 1.7, 2.5, 4.0, 7.0, 15.0];
    const records = new Map(
      rcrs.map((v, i) => [String(i + 1), rec(i + 1, { relative_citation_ratio: v })]),
    );
    const s = computeSummary({
      totalRows: rcrs.length,
      invalid: 0,
      requestedPmids: [...records.keys()],
      records,
    });
    const byLabel = Object.fromEntries(s.rcr.histogram.map((b) => [b.label, b.count]));
    expect(byLabel["0–0.5"]).toBe(1);
    expect(byLabel["0.5–1"]).toBe(1);
    expect(byLabel["1–1.5"]).toBe(1);
    expect(byLabel["1.5–2"]).toBe(1);
    expect(byLabel["2–3"]).toBe(1);
    expect(byLabel["3–5"]).toBe(1);
    expect(byLabel["5–10"]).toBe(1);
    expect(byLabel["10+"]).toBe(1);
  });

  it("year histogram sorted ascending", () => {
    const records = new Map([
      ["1", rec(1, { year: 2020 })],
      ["2", rec(2, { year: 2022 })],
      ["3", rec(3, { year: 2020 })],
    ]);
    const s = computeSummary({
      totalRows: 3,
      invalid: 0,
      requestedPmids: [...records.keys()],
      records,
    });
    expect(s.yearHistogram.map((b) => b.label)).toEqual(["2020", "2022"]);
    expect(s.yearHistogram.find((b) => b.label === "2020")?.count).toBe(2);
  });

  it("top journals sorted desc, ignores blanks", () => {
    const records = new Map([
      ["1", rec(1, { journal: "Cell" })],
      ["2", rec(2, { journal: "Cell" })],
      ["3", rec(3, { journal: "Nature" })],
      ["4", rec(4, { journal: "" })],
    ]);
    const s = computeSummary({
      totalRows: 4,
      invalid: 0,
      requestedPmids: [...records.keys()],
      records,
    });
    expect(s.topJournals[0]).toEqual({ journal: "Cell", count: 2 });
    expect(s.topJournals[1]).toEqual({ journal: "Nature", count: 1 });
    expect(s.topJournals.length).toBe(2);
  });

  it("clinical / animal / APT percentages", () => {
    const records = new Map([
      ["1", rec(1, { is_clinical: true, animal: 0, apt: 0.9 })],
      ["2", rec(2, { is_clinical: false, animal: 0.9, apt: 0.4 })],
      ["3", rec(3, { is_clinical: false, animal: 0, apt: 0.5 })],
      ["4", rec(4, { is_clinical: true, animal: 0, apt: 0.1 })],
    ]);
    const s = computeSummary({
      totalRows: 4,
      invalid: 0,
      requestedPmids: [...records.keys()],
      records,
    });
    expect(s.pctClinical).toBe(50);
    expect(s.pctAnimal).toBe(25);
    expect(s.pctHasTranslationPotential).toBe(50);
  });

  it("top cited sorted descending and limited", () => {
    const records = new Map(
      Array.from({ length: 14 }, (_, i) => [
        String(i + 1),
        rec(i + 1, { citation_count: (i + 1) * 10 }),
      ]),
    );
    const s = computeSummary({
      totalRows: 14,
      invalid: 0,
      requestedPmids: [...records.keys()],
      records,
      topNPapers: 5,
    });
    expect(s.topCitedPapers.length).toBe(5);
    expect(s.topCitedPapers[0].citationCount).toBe(140);
  });

  it("empty input returns nulls and zeros", () => {
    const s = computeSummary({
      totalRows: 0,
      invalid: 0,
      requestedPmids: [],
      records: new Map(),
    });
    expect(s.matched).toBe(0);
    expect(s.rcr.mean).toBeNull();
    expect(s.rcr.above1Pct).toBeNull();
    expect(s.topJournals).toEqual([]);
    expect(s.topCitedPapers).toEqual([]);
  });
});
