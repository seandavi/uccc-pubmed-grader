/**
 * Run an async `worker` over `items` with a fixed concurrency cap, calling
 * `onProgress` after each item completes. Order of results matches `items`.
 *
 * Used to spread per-record Unpaywall calls across N in-flight requests
 * without firing thousands at once.
 */

export type WorkerResult<R> = { ok: true; value: R } | { ok: false; error: unknown };

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  options: {
    signal?: AbortSignal;
    onProgress?: (processed: number, total: number) => void;
  } = {},
): Promise<WorkerResult<R>[]> {
  if (concurrency < 1) throw new Error("concurrency must be >= 1");
  const total = items.length;
  const results: WorkerResult<R>[] = new Array(total);
  let processed = 0;
  let cursor = 0;

  const runOne = async (): Promise<void> => {
    while (cursor < total) {
      if (options.signal?.aborted) return;
      const i = cursor;
      cursor += 1;
      try {
        const value = await worker(items[i], i);
        results[i] = { ok: true, value };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        results[i] = { ok: false, error };
      }
      processed += 1;
      options.onProgress?.(processed, total);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, total) }, runOne);
  await Promise.all(workers);
  return results;
}
