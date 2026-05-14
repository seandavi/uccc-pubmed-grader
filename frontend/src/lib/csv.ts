/**
 * CSV parsing + augmentation, run entirely in the browser.
 *
 * - Detects PMID column case-insensitively (default `pmid`); allows override.
 * - Validates PMIDs (`^\d{1,9}$`); rows whose PMID fails validation are KEPT
 *   in the output and reported via `invalidRows`. Fully blank lines, on the
 *   other hand, are dropped — they're treated as input whitespace rather
 *   than user data.
 * - On augment, renames iCite columns that collide with user columns by
 *   prefixing with `icite_` so user data is preserved unchanged.
 */

import Papa from "papaparse";

import type { ICiteRecord } from "./icite";

export const PMID_PATTERN = /^\d{1,9}$/;
export const DEFAULT_PMID_COLUMN = "pmid";
export const ICITE_PREFIX = "icite_";

export class CSVParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CSVParseError";
  }
}

export type ParsedCSV = {
  fieldnames: string[];
  pmidColumn: string;
  rows: Record<string, string>[];
  invalidRows: { rowNumber: number; value: string }[];
};

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function resolvePmidColumn(fieldnames: string[], requested: string | undefined): string {
  const target = (requested ?? DEFAULT_PMID_COLUMN).trim().toLowerCase();
  if (!target) throw new CSVParseError("PMID column name cannot be empty");
  for (const name of fieldnames) {
    if (name.trim().toLowerCase() === target) return name;
  }
  throw new CSVParseError(
    `PMID column ${JSON.stringify(requested ?? DEFAULT_PMID_COLUMN)} not found in CSV ` +
      `(headers: ${JSON.stringify(fieldnames)})`,
  );
}

export function parseCSV(content: string, pmidColumn?: string): ParsedCSV {
  const text = stripBom(content);
  if (!text.trim()) throw new CSVParseError("CSV is empty");

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter: ",",
    skipEmptyLines: "greedy",
    transformHeader: (h) => h,
  });
  // PapaParse reports structural problems in `errors`. Surface only true
  // parser-level failures (e.g. mismatched quotes). Field-count mismatches
  // and delimiter-detection warnings are noise on small/single-column CSVs.
  const fatal = parsed.errors.filter(
    (e) => e.type !== "FieldMismatch" && e.type !== "Delimiter",
  );
  if (fatal.length > 0) {
    throw new CSVParseError(`CSV parse error: ${fatal[0].message}`);
  }

  const fieldnames = (parsed.meta.fields ?? []).slice();
  if (fieldnames.length === 0) throw new CSVParseError("CSV has no header row");

  const resolved = resolvePmidColumn(fieldnames, pmidColumn);
  const rows: Record<string, string>[] = [];
  const invalidRows: { rowNumber: number; value: string }[] = [];
  parsed.data.forEach((row, idx) => {
    const clean: Record<string, string> = {};
    for (const k of fieldnames) clean[k] = row[k] ?? "";
    rows.push(clean);
    const value = (clean[resolved] ?? "").trim();
    if (!PMID_PATTERN.test(value)) {
      invalidRows.push({ rowNumber: idx + 1, value });
    }
  });

  return { fieldnames, pmidColumn: resolved, rows, invalidRows };
}

export function validPmids(parsed: ParsedCSV): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of parsed.rows) {
    const value = (row[parsed.pmidColumn] ?? "").trim();
    if (PMID_PATTERN.test(value) && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

export function resolveOutputColumns(
  userFieldnames: readonly string[],
  icite: readonly (keyof ICiteRecord)[],
): Map<keyof ICiteRecord, string> {
  const used = new Set(userFieldnames.map((n) => n.trim().toLowerCase()));
  const out = new Map<keyof ICiteRecord, string>();
  for (const src of icite) {
    let candidate = String(src);
    if (used.has(candidate.toLowerCase())) candidate = `${ICITE_PREFIX}${src}`;
    const base = candidate;
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}_${n}`;
      n += 1;
    }
    out.set(src, candidate);
    used.add(candidate.toLowerCase());
  }
  return out;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/**
 * Provenance columns appended to every augmented CSV. They live alongside
 * the iCite-rename map so collision-safe naming works the same way.
 */
export type Provenance = {
  appVersion: string; // e.g. "0.1.0+a659029"
  dateRun: string; // ISO timestamp
};

const PROVENANCE_COLUMNS = ["app_version", "date_run"] as const;

export function writeAugmentedCSV(
  parsed: ParsedCSV,
  records: Map<string, ICiteRecord>,
  icite: readonly (keyof ICiteRecord)[],
  provenance?: Provenance,
): string {
  const rename = resolveOutputColumns(parsed.fieldnames, icite);
  const outputCols: string[] = [...parsed.fieldnames];
  for (const src of icite) outputCols.push(rename.get(src)!);

  // Resolve provenance column names against the same collision rules so a
  // user CSV that already has an `app_version` column isn't overwritten.
  const provenanceRename = new Map<string, string>();
  if (provenance) {
    const used = new Set(outputCols.map((n) => n.trim().toLowerCase()));
    for (const src of PROVENANCE_COLUMNS) {
      let candidate = src as string;
      if (used.has(candidate.toLowerCase())) candidate = `icite_${candidate}`;
      let n = 2;
      const base = candidate;
      while (used.has(candidate.toLowerCase())) {
        candidate = `${base}_${n}`;
        n += 1;
      }
      provenanceRename.set(src, candidate);
      used.add(candidate.toLowerCase());
      outputCols.push(candidate);
    }
  }

  const rows = parsed.rows.map((row) => {
    const pmid = (row[parsed.pmidColumn] ?? "").trim();
    const record = records.get(pmid);
    const augmented: Record<string, string> = { ...row };
    for (const src of icite) {
      const value = record ? (record as Record<string, unknown>)[src as string] : undefined;
      augmented[rename.get(src)!] = formatValue(value);
    }
    if (provenance) {
      augmented[provenanceRename.get("app_version")!] = provenance.appVersion;
      augmented[provenanceRename.get("date_run")!] = provenance.dateRun;
    }
    return outputCols.map((col) => augmented[col] ?? "");
  });

  return Papa.unparse([outputCols, ...rows], {
    quotes: false,
    newline: "\n",
  });
}
