/**
 * Altmetric attention scores by PMID.
 *
 * API: https://api.altmetric.com/v1/pmid/{pmid}
 * - 404 if Altmetric has nothing for the paper — treat as "no data," not an error.
 * - 403 is rate-limit; we don't retry, just skip.
 * - No auth required for the free tier.
 */

import { mapWithConcurrency } from "./concurrent";

const ALTMETRIC_BASE = "https://api.altmetric.com/v1/pmid";
const DEFAULT_CONCURRENCY = 6;

export type AltmetricRecord = {
  pmid: string;
  score: number;
  detailsUrl: string | null;
};

export type FetchOptions = {
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
  fetchImpl?: typeof fetch;
};

async function fetchOne(
  pmid: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal | undefined,
): Promise<AltmetricRecord | null> {
  const response = await fetchImpl(`${ALTMETRIC_BASE}/${encodeURIComponent(pmid)}`, { signal });
  if (response.status === 404 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Altmetric returned ${response.status}`);
  }
  const payload = (await response.json()) as {
    pmid?: string | number;
    score?: number;
    details_url?: string | null;
  };
  if (!payload || typeof payload !== "object") return null;
  const score = typeof payload.score === "number" ? payload.score : null;
  if (score === null) return null;
  return {
    pmid,
    score,
    detailsUrl: payload.details_url ?? null,
  };
}

export async function fetchAltmetric(
  pmids: readonly string[],
  options: FetchOptions = {},
): Promise<Map<string, AltmetricRecord>> {
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  const out = new Map<string, AltmetricRecord>();
  const results = await mapWithConcurrency(
    pmids,
    concurrency,
    (pmid) => fetchOne(pmid, fetchImpl, options.signal),
    { signal: options.signal, onProgress: options.onProgress },
  );
  results.forEach((r, i) => {
    if (r.ok && r.value) out.set(pmids[i], r.value);
  });
  return out;
}
