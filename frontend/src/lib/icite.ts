/**
 * Browser-side NIH iCite client.
 *
 * iCite returns bibliometric metrics for PubMed IDs. The `/api/pubs` endpoint
 * accepts a comma-separated `pmids` query parameter (hundreds per call) and
 * returns `{ "data": [...] }`. Unknown PMIDs are omitted from `data`.
 *
 * Calls happen directly from the browser — iCite advertises CORS for any origin.
 */

const ICITE_URL = "https://icite.od.nih.gov/api/pubs";
const DEFAULT_BATCH_SIZE = 200;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export type ICiteRecord = {
  pmid: number;
  year?: number;
  title?: string;
  authors?: string;
  journal?: string;
  is_research_article?: boolean;
  relative_citation_ratio?: number | null;
  nih_percentile?: number | null;
  human?: number | null;
  animal?: number | null;
  molecular_cellular?: number | null;
  apt?: number | null;
  is_clinical?: boolean;
  citation_count?: number | null;
  citations_per_year?: number | null;
  expected_citations_per_year?: number | null;
  field_citation_rate?: number | null;
  provisional?: boolean;
  x_coord?: number | null;
  y_coord?: number | null;
  cited_by_clin?: string;
  cited_by?: string;
  references?: string;
  doi?: string;
  last_modified?: string;
};

export const ICITE_COLUMNS: readonly (keyof ICiteRecord)[] = [
  "year",
  "title",
  "authors",
  "journal",
  "is_research_article",
  "relative_citation_ratio",
  "nih_percentile",
  "human",
  "animal",
  "molecular_cellular",
  "apt",
  "is_clinical",
  "citation_count",
  "citations_per_year",
  "expected_citations_per_year",
  "field_citation_rate",
  "provisional",
  "x_coord",
  "y_coord",
  "cited_by_clin",
  "cited_by",
  "references",
  "doi",
  "last_modified",
];

export type BatchResult = {
  requested: string[];
  records: Map<string, ICiteRecord>;
};

export type BatchProgress = {
  processed: number;
  total: number;
};

export class ICiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ICiteError";
  }
}

/** Thrown for transient failures iCite is expected to recover from. */
export class ICiteRetryableError extends ICiteError {
  constructor(message: string) {
    super(message);
    this.name = "ICiteRetryableError";
  }
}

export type FetchOptions = {
  batchSize?: number;
  maxAttempts?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

function* chunked<T>(items: readonly T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}

async function fetchOnce(
  pmids: readonly string[],
  baseUrl: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal | undefined,
): Promise<BatchResult> {
  const url = `${baseUrl}?pmids=${encodeURIComponent(pmids.join(","))}`;
  const response = await fetchImpl(url, { signal });
  if (RETRYABLE_STATUS.has(response.status)) {
    throw new ICiteRetryableError(`iCite returned retryable status ${response.status}`);
  }
  if (!response.ok) {
    throw new ICiteError(`iCite returned ${response.status}`);
  }
  let payload: { data?: ICiteRecord[] };
  try {
    payload = (await response.json()) as { data?: ICiteRecord[] };
  } catch (err) {
    // iCite is meant to return JSON; if a proxy or edge returned HTML we'd
    // hit SyntaxError here. Surface it as a (non-retryable) ICiteError so
    // the UI sees a clean message instead of a raw parser exception.
    throw new ICiteError(
      `iCite returned non-JSON response: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) {
    throw new ICiteError("unexpected iCite response shape");
  }
  const records = new Map<string, ICiteRecord>();
  for (const item of payload.data) {
    if (item && typeof item === "object" && "pmid" in item) {
      records.set(String(item.pmid), item);
    }
  }
  return { requested: [...pmids], records };
}

async function fetchBatchWithRetry(
  pmids: readonly string[],
  opts: Required<Omit<FetchOptions, "signal">> & { signal: AbortSignal | undefined },
): Promise<BatchResult> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < opts.maxAttempts) {
    try {
      return await fetchOnce(pmids, opts.baseUrl, opts.fetchImpl, opts.signal);
    } catch (err) {
      lastErr = err;
      // Only retry our retryable signal or transient network errors. Abort
      // bubbles immediately; anything else is fatal.
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      // Only retry retryable signals; non-retryable ICiteError (e.g. 400, 404)
      // surfaces immediately.
      if (!(err instanceof ICiteRetryableError) && !(err instanceof TypeError)) {
        throw err;
      }
      attempt += 1;
      if (attempt >= opts.maxAttempts) break;
      const delay = Math.min(8000, 500 * 2 ** (attempt - 1));
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new ICiteError(String(lastErr));
}

/**
 * Iterate iCite results in batches so the caller can drive a progress bar.
 */
export async function* fetchMany(
  pmids: readonly string[],
  options: FetchOptions = {},
): AsyncGenerator<BatchResult> {
  const opts = {
    batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
    maxAttempts: options.maxAttempts ?? 4,
    baseUrl: options.baseUrl ?? ICITE_URL,
    fetchImpl: options.fetchImpl ?? fetch.bind(globalThis),
    signal: options.signal,
  };
  if (opts.batchSize < 1) throw new Error("batchSize must be >= 1");
  for (const chunk of chunked(pmids, opts.batchSize)) {
    yield await fetchBatchWithRetry(chunk, opts);
  }
}
