import { describe, expect, it } from "vitest";

import {
  CSVParseError,
  parseCSV,
  resolveOutputColumns,
  validPmids,
  writeAugmentedCSV,
} from "../csv";
import type { ICiteRecord } from "../icite";

describe("parseCSV", () => {
  it("detects pmid header case-insensitively", () => {
    const parsed = parseCSV("PMID,author\n111,Smith\n");
    expect(parsed.pmidColumn).toBe("PMID");
    expect(validPmids(parsed)).toEqual(["111"]);
  });

  it("accepts custom column override", () => {
    const parsed = parseCSV("id,pubmed_id,title\n1,111,Foo\n", "pubmed_id");
    expect(parsed.pmidColumn).toBe("pubmed_id");
    expect(validPmids(parsed)).toEqual(["111"]);
  });

  it("raises when column not found", () => {
    expect(() => parseCSV("foo,bar\n1,2\n")).toThrow(CSVParseError);
  });

  it("records invalid-PMID rows but drops fully blank lines", () => {
    const parsed = parseCSV("pmid\n111\nabc\n\n");
    expect(parsed.rows.length).toBe(2);
    expect(validPmids(parsed)).toEqual(["111"]);
    expect(parsed.invalidRows.map((r) => r.value)).toEqual(["abc"]);
  });

  it("surfaces fatal PapaParse errors as CSVParseError", () => {
    // Unterminated quote — PapaParse reports a Quotes error
    expect(() => parseCSV('pmid,note\n111,"unterminated\n')).toThrow(CSVParseError);
  });

  it("dedupes PMIDs", () => {
    const parsed = parseCSV("pmid\n111\n111\n222\n");
    expect(validPmids(parsed)).toEqual(["111", "222"]);
  });

  it("rejects empty input", () => {
    expect(() => parseCSV("   \n")).toThrow(CSVParseError);
  });

  it("strips BOM", () => {
    const parsed = parseCSV("﻿pmid,author\n111,Smith\n");
    expect(parsed.pmidColumn).toBe("pmid");
    expect(validPmids(parsed)).toEqual(["111"]);
  });
});

describe("resolveOutputColumns", () => {
  it("returns iCite names unchanged when no collision", () => {
    const rename = resolveOutputColumns(["pmid", "note"], ["year", "title"]);
    expect(rename.get("year")).toBe("year");
    expect(rename.get("title")).toBe("title");
  });

  it("prefixes colliding iCite columns with icite_", () => {
    const rename = resolveOutputColumns(["pmid", "year", "title"], ["year", "title", "journal"]);
    expect(rename.get("year")).toBe("icite_year");
    expect(rename.get("title")).toBe("icite_title");
    expect(rename.get("journal")).toBe("journal");
  });

  it("collision check is case-insensitive", () => {
    const rename = resolveOutputColumns(["pmid", "Year"], ["year"]);
    expect(rename.get("year")).toBe("icite_year");
  });
});

describe("writeAugmentedCSV", () => {
  function rec(extra: Partial<ICiteRecord>): ICiteRecord {
    return { pmid: 0, ...extra } as ICiteRecord;
  }

  it("appends iCite columns after user columns", () => {
    const parsed = parseCSV("pmid,name\n111,A\n");
    const records = new Map<string, ICiteRecord>([
      ["111", rec({ pmid: 111, year: 2020, title: "Paper A" })],
    ]);
    const out = writeAugmentedCSV(parsed, records, ["year", "title"]);
    const lines = out.trim().split("\n");
    expect(lines[0]).toBe("pmid,name,year,title");
    expect(lines[1]).toBe("111,A,2020,Paper A");
  });

  it("renames collisions so user data survives", () => {
    const parsed = parseCSV("pmid,year,title\n111,1999,User Title\n");
    const records = new Map<string, ICiteRecord>([
      ["111", rec({ pmid: 111, year: 2020, title: "iCite Title" })],
    ]);
    const out = writeAugmentedCSV(parsed, records, ["year", "title"]);
    const lines = out.trim().split("\n");
    expect(lines[0]).toBe("pmid,year,title,icite_year,icite_title");
    expect(lines[1]).toContain("1999"); // user year
    expect(lines[1]).toContain("User Title");
    expect(lines[1]).toContain("2020"); // iCite year
    expect(lines[1]).toContain("iCite Title");
  });

  it("renders booleans lowercase and nulls as empty", () => {
    const parsed = parseCSV("pmid\n111\n");
    const records = new Map<string, ICiteRecord>([
      [
        "111",
        rec({
          pmid: 111,
          is_clinical: true,
          relative_citation_ratio: null,
        }),
      ],
    ]);
    const out = writeAugmentedCSV(parsed, records, ["is_clinical", "relative_citation_ratio"]);
    const lines = out.trim().split("\n");
    expect(lines[1]).toBe("111,true,");
  });

  it("preserves original row order", () => {
    const parsed = parseCSV("name,pmid\nAlpha,222\nBeta,111\n");
    const out = writeAugmentedCSV(parsed, new Map(), ["year"]);
    const lines = out.trim().split("\n");
    expect(lines[1].startsWith("Alpha,222")).toBe(true);
    expect(lines[2].startsWith("Beta,111")).toBe(true);
  });

  it("appends provenance columns when provided", () => {
    const parsed = parseCSV("pmid\n111\n");
    const out = writeAugmentedCSV(parsed, new Map(), ["year"], {
      appVersion: "0.1.0+abc1234",
      dateRun: "2026-05-14T08:00:00.000Z",
    });
    const lines = out.trim().split("\n");
    expect(lines[0]).toBe("pmid,year,app_version,date_run");
    expect(lines[1]).toBe("111,,0.1.0+abc1234,2026-05-14T08:00:00.000Z");
  });

  it("renames provenance columns on collision with user columns", () => {
    const parsed = parseCSV("pmid,app_version\n111,user_value\n");
    const out = writeAugmentedCSV(parsed, new Map(), [], {
      appVersion: "0.1.0+abc1234",
      dateRun: "2026-05-14T08:00:00.000Z",
    });
    const lines = out.trim().split("\n");
    expect(lines[0]).toBe("pmid,app_version,icite_app_version,date_run");
    expect(lines[1]).toBe("111,user_value,0.1.0+abc1234,2026-05-14T08:00:00.000Z");
  });
});
