/**
 * Human-readable descriptions for every column the app appends to the
 * user's CSV. This is the single source of truth: both the in-app
 * `/columns` page and the docs/DATA_DICTIONARY.md (if added later)
 * read from here.
 *
 * Add a new column? Update both the iCite type / writer AND this list.
 */

export type ColumnDoc = {
  name: string;
  source: "iCite" | "Unpaywall" | "Altmetric" | "App";
  type: "number" | "integer" | "string" | "boolean" | "date" | "fraction" | "url";
  description: string;
};

export const COLUMN_DICTIONARY: readonly ColumnDoc[] = [
  // --- iCite fields ----------------------------------------------------
  {
    name: "year",
    source: "iCite",
    type: "integer",
    description: "Publication year. Reflects iCite's record, not the issue date.",
  },
  {
    name: "title",
    source: "iCite",
    type: "string",
    description: "Article title as indexed by PubMed / iCite.",
  },
  {
    name: "authors",
    source: "iCite",
    type: "string",
    description: "Author list, comma-joined. Order matches PubMed.",
  },
  {
    name: "journal",
    source: "iCite",
    type: "string",
    description: "Journal abbreviation. Use this for grouping.",
  },
  {
    name: "is_research_article",
    source: "iCite",
    type: "boolean",
    description:
      "true for original research articles; false for reviews, editorials, letters, etc.",
  },
  {
    name: "relative_citation_ratio",
    source: "iCite",
    type: "number",
    description:
      "RCR — citation rate normalized to the paper's field. 1.0 = NIH-funded median; > 2 is high impact; > 10 is exceptional. Skewed right; report median for portfolios.",
  },
  {
    name: "nih_percentile",
    source: "iCite",
    type: "number",
    description: "Rank of this RCR among NIH-funded papers (0–100, higher is better).",
  },
  {
    name: "human",
    source: "iCite",
    type: "fraction",
    description: "Fraction of the paper's subject matter classified as human research (0–1).",
  },
  {
    name: "animal",
    source: "iCite",
    type: "fraction",
    description: "Fraction classified as animal research (0–1). Dashboard calls > 0.5 animal-dominant.",
  },
  {
    name: "molecular_cellular",
    source: "iCite",
    type: "fraction",
    description: "Fraction classified as molecular/cellular research (0–1).",
  },
  {
    name: "apt",
    source: "iCite",
    type: "fraction",
    description:
      "Approximate Potential to Translate (0–1). iCite's estimate of how likely this paper is to be cited by a clinical paper downstream. Dashboard counts ≥ 0.5 as having translation potential.",
  },
  {
    name: "is_clinical",
    source: "iCite",
    type: "boolean",
    description: "true if iCite classifies the paper as clinical.",
  },
  {
    name: "citation_count",
    source: "iCite",
    type: "integer",
    description: "Total citations as of iCite's last update.",
  },
  {
    name: "citations_per_year",
    source: "iCite",
    type: "number",
    description: "Citations divided by years since publication.",
  },
  {
    name: "expected_citations_per_year",
    source: "iCite",
    type: "number",
    description: "Field-normalized expected rate. Used internally for RCR.",
  },
  {
    name: "field_citation_rate",
    source: "iCite",
    type: "number",
    description: "Average citation rate of the paper's co-citation network.",
  },
  {
    name: "provisional",
    source: "iCite",
    type: "boolean",
    description: "true when RCR is provisional — the paper is too recent for a stable RCR.",
  },
  {
    name: "x_coord",
    source: "iCite",
    type: "number",
    description: "Co-citation network coordinate (visualization use).",
  },
  {
    name: "y_coord",
    source: "iCite",
    type: "number",
    description: "Co-citation network coordinate (visualization use).",
  },
  {
    name: "cited_by_clin",
    source: "iCite",
    type: "string",
    description: "Space-separated PMIDs of clinical papers citing this paper.",
  },
  {
    name: "cited_by",
    source: "iCite",
    type: "string",
    description: "Space-separated PMIDs of all papers citing this paper.",
  },
  {
    name: "references",
    source: "iCite",
    type: "string",
    description: "Space-separated PMIDs of papers this paper cites.",
  },
  {
    name: "doi",
    source: "iCite",
    type: "string",
    description: "DOI for the paper, when iCite has one.",
  },
  {
    name: "last_modified",
    source: "iCite",
    type: "date",
    description: "ISO date iCite last refreshed this record.",
  },

  // --- Unpaywall fields (joined by DOI) -------------------------------
  {
    name: "is_oa",
    source: "Unpaywall",
    type: "boolean",
    description:
      "Whether Unpaywall classifies the paper as Open Access (any flavor). Blank when the DOI was missing or not in Unpaywall.",
  },
  {
    name: "oa_status",
    source: "Unpaywall",
    type: "string",
    description:
      "Unpaywall OA classification: gold (OA journal), green (preprint/repo), hybrid (paid journal + OA article), bronze (free to read, no license), or closed. \"unknown\" if Unpaywall returned an unexpected value.",
  },
  {
    name: "oa_url",
    source: "Unpaywall",
    type: "url",
    description:
      "Best available URL for an OA copy (preferring PDF). Blank when no OA copy is known.",
  },

  // --- Altmetric fields (joined by PMID) ------------------------------
  {
    name: "altmetric_score",
    source: "Altmetric",
    type: "number",
    description:
      "Altmetric Attention Score — a weighted measure of social / news / policy attention. Blank when Altmetric has no record for the PMID.",
  },
  {
    name: "altmetric_url",
    source: "Altmetric",
    type: "url",
    description: "Public details page on altmetric.com for this paper.",
  },

  // --- App-added provenance fields ------------------------------------
  {
    name: "app_version",
    source: "App",
    type: "string",
    description:
      "Version label of the grader app that produced this row, in the form <version>+<git-sha>. Useful for tracing reproducibility of a specific download.",
  },
  {
    name: "date_run",
    source: "App",
    type: "date",
    description:
      "UTC ISO timestamp of when this CSV was generated. The same value is written to every row in a single run.",
  },
];
