/**
 * Unpaywall client — checks Open Access status for a DOI.
 *
 * API: https://api.unpaywall.org/v2/{doi}?email=...
 * - Per-DOI (no batching).
 * - 404 means "not in Unpaywall" — treat as "no data", not an error.
 * - Requires an email per ToS.
 *
 * Email is read from VITE_UNPAYWALL_EMAIL at build time, with a generic
 * fallback so the app still functions when the env var isn't set.
 */

import { mapWithConcurrency } from "./concurrent";

const UNPAYWALL_BASE = "https://api.unpaywall.org/v2";
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_EMAIL =
  (import.meta.env.VITE_UNPAYWALL_EMAIL as string | undefined) ?? "noreply@pubmed-grader.app";

export type OAStatus = "gold" | "green" | "hybrid" | "bronze" | "closed" | "unknown";

export type UnpaywallRecord = {
  doi: string;
  isOA: boolean;
  oaStatus: OAStatus;
  bestOAUrl: string | null;
};

export type FetchOptions = {
  email?: string;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
  fetchImpl?: typeof fetch;
};

function coerceOAStatus(raw: unknown): OAStatus {
  if (typeof raw !== "string") return "unknown";
  const v = raw.toLowerCase();
  if (v === "gold" || v === "green" || v === "hybrid" || v === "bronze" || v === "closed") {
    return v;
  }
  return "unknown";
}

async function fetchOne(
  doi: string,
  email: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal | undefined,
): Promise<UnpaywallRecord | null> {
  if (!doi || !doi.toLowerCase().startsWith("10.")) return null;
  const url = `${UNPAYWALL_BASE}/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`;
  const response = await fetchImpl(url, { signal });
  if (response.status === 404 || response.status === 422) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Unpaywall returned ${response.status}`);
  }
  const payload = (await response.json()) as {
    doi?: string;
    is_oa?: boolean;
    oa_status?: string;
    best_oa_location?: { url_for_pdf?: string | null; url?: string | null } | null;
  };
  if (!payload || typeof payload !== "object") return null;
  const oaStatus = coerceOAStatus(payload.oa_status);
  const bestUrl =
    payload.best_oa_location?.url_for_pdf ?? payload.best_oa_location?.url ?? null;
  return {
    doi,
    isOA: Boolean(payload.is_oa),
    oaStatus,
    bestOAUrl: bestUrl,
  };
}

/**
 * Fetch Unpaywall records for a set of DOIs. Returns a map keyed by DOI.
 * Failures (network errors, non-404 errors) are logged and skipped; the
 * caller treats missing entries as "no OA data."
 */
export async function fetchUnpaywall(
  dois: readonly string[],
  options: FetchOptions = {},
): Promise<Map<string, UnpaywallRecord>> {
  const email = options.email ?? DEFAULT_EMAIL;
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  const out = new Map<string, UnpaywallRecord>();
  const results = await mapWithConcurrency(
    dois,
    concurrency,
    (doi) => fetchOne(doi, email, fetchImpl, options.signal),
    { signal: options.signal, onProgress: options.onProgress },
  );
  results.forEach((r, i) => {
    if (r.ok && r.value) out.set(dois[i], r.value);
  });
  return out;
}
