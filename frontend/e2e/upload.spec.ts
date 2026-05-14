import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = path.resolve(__dirname, "..", "test-fixtures", "sample-pmids.csv");

// Synthetic iCite payload for the 10 PMIDs in the fixture. Returning controlled
// data keeps the e2e test fast and deterministic — no live NIH API calls.
const ICITE_RECORDS = [
  { pmid: 27599876, year: 2017, title: "Synthetic A", journal: "Cell", relative_citation_ratio: 4.2, citation_count: 120, is_clinical: true, animal: 0, apt: 0.6 },
  { pmid: 22439929, year: 2011, title: "Hallmarks of cancer: next generation", journal: "Cell", relative_citation_ratio: 184.0, citation_count: 50000, is_clinical: false, animal: 0, apt: 0.9 },
  { pmid: 23467010, year: 2013, title: "Synthetic C", journal: "Nature", relative_citation_ratio: 6.8, citation_count: 220, is_clinical: false, animal: 0, apt: 0.5 },
  { pmid: 21376230, year: 2011, title: "Synthetic D", journal: "Nature", relative_citation_ratio: 8.1, citation_count: 410, is_clinical: false, animal: 0, apt: 0.5 },
  { pmid: 17891175, year: 2008, title: "Synthetic E", journal: "Lancet", relative_citation_ratio: 2.0, citation_count: 90, is_clinical: false, animal: 0.7, apt: 0.4 },
  { pmid: 17923852, year: 2008, title: "Synthetic F", journal: "Lancet", relative_citation_ratio: 5.4, citation_count: 200, is_clinical: false, animal: 0, apt: 0.5 },
  { pmid: 22341822, year: 2012, title: "Synthetic G", journal: "Int J Cancer", relative_citation_ratio: 1.7, citation_count: 65, is_clinical: false, animal: 0.6, apt: 0.3 },
  { pmid: 21376232, year: 2011, title: "Synthetic H", journal: "Acta Trop", relative_citation_ratio: 0.6, citation_count: 14, is_clinical: false, animal: 0.9, apt: 0.2 },
  { pmid: 12490959, year: 2002, title: "Synthetic I", journal: "Oncogene", relative_citation_ratio: 3.3, citation_count: 350, is_clinical: false, animal: 0, apt: 0.5 },
  { pmid: 18632642, year: 2008, title: "Synthetic J", journal: "Pharmacogenomics", relative_citation_ratio: 1.1, citation_count: 30, is_clinical: false, animal: 0.8, apt: 0.6 },
];

test("upload → process → dashboard → download", async ({ page }) => {
  await page.route("**/icite.od.nih.gov/api/pubs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: ICITE_RECORDS }),
    });
  });
  // Mock Unpaywall: anything goes "gold" except 10.1056/* which is closed.
  await page.route("**/api.unpaywall.org/**", async (route) => {
    const url = route.request().url();
    const isClosed = url.includes("10.1056");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        is_oa: !isClosed,
        oa_status: isClosed ? "closed" : "gold",
        best_oa_location: isClosed ? null : { url_for_pdf: "https://example.org/pdf" },
      }),
    });
  });
  // Mock Altmetric: a few PMIDs have scores, others 404.
  const altmetricScores: Record<string, number> = {
    "22439929": 250,
    "27599876": 80,
  };
  await page.route("**/api.altmetric.com/**", async (route) => {
    const url = route.request().url();
    const pmid = url.split("/").pop() ?? "";
    const score = altmetricScores[pmid];
    if (score === undefined) {
      await route.fulfill({ status: 404 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pmid, score, details_url: `https://altmetric.com/${pmid}` }),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Publication Impact Grader/i })).toBeVisible();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Upload CSV file/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(SAMPLE_CSV);

  // Wait for the dashboard headline that only renders post-success.
  await expect(page.getByRole("heading", { name: /papers, read/i })).toBeVisible({
    timeout: 15_000,
  });

  // KPI cards rendered with non-empty values, including the new OA + Altmetric tiles
  for (const label of [
    "Median RCR",
    "Above NIH baseline",
    "Open Access",
    "Clinical",
    "Translation potential",
    "Median Altmetric",
  ]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }

  // Top by Altmetric attention table shows our top-scored paper
  await expect(page.getByRole("heading", { name: "Top by Altmetric attention" })).toBeVisible();

  // Top-cited papers section shows real entries
  await expect(page.getByRole("heading", { name: "Top-cited papers" })).toBeVisible();
  await expect(page.getByText("Hallmarks of cancer: next generation").first()).toBeVisible();

  // Download flow
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download augmented CSV/i }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const fs = await import("node:fs/promises");
  const text = await fs.readFile(downloadPath!, "utf-8");

  // Original columns preserved, iCite + enrichment + provenance columns appended
  const header = text.split("\n")[0];
  expect(header).toContain("pmid");
  expect(header).toContain("investigator");
  expect(header).toContain("division");
  expect(header).toContain("relative_citation_ratio");
  expect(header).toContain("citation_count");
  expect(header).toContain("is_oa");
  expect(header).toContain("oa_status");
  expect(header).toContain("altmetric_score");
  expect(header).toContain("app_version");
  expect(header).toContain("date_run");
  expect(text).toContain("Hallmarks of cancer: next generation");
});

test("invalid PMID column surfaces error state", async ({ page }) => {
  // Don't even need to mock anything — parsing fails before any HTTP call.
  await page.route("**/icite.od.nih.gov/**", (route) => route.abort());
  await page.route("**/api.unpaywall.org/**", (route) => route.abort());
  await page.route("**/api.altmetric.com/**", (route) => route.abort());

  await page.goto("/");
  await page.getByLabel("PMID column name").fill("nonexistent_column");

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Upload CSV file/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(SAMPLE_CSV);

  await expect(page.getByText(/PMID column/i).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: /Try again/i })).toBeVisible();
});
