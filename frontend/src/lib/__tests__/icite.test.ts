import { describe, expect, it } from "vitest";

import { ICiteError, fetchMany } from "../icite";
import type { ICiteRecord } from "../icite";

function makeRecord(pmid: number, extra: Partial<ICiteRecord> = {}): ICiteRecord {
  return {
    pmid,
    title: `Paper ${pmid}`,
    journal: "Nature",
    year: 2020,
    relative_citation_ratio: 1.5,
    ...extra,
  };
}

function fakeFetch(
  responses: Array<
    | { status: number; body?: unknown }
    | ((url: string) => { status: number; body?: unknown })
  >,
) {
  let i = 0;
  const calls: string[] = [];
  const impl: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const r = typeof next === "function" ? next(url) : next;
    return new Response(JSON.stringify(r.body ?? {}), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fetch: impl, calls };
}

describe("fetchMany", () => {
  it("returns records keyed by PMID on happy path", async () => {
    const { fetch } = fakeFetch([
      { status: 200, body: { data: [makeRecord(111), makeRecord(222)] } },
    ]);
    const batches = [];
    for await (const b of fetchMany(["111", "222"], { fetchImpl: fetch, batchSize: 50 })) {
      batches.push(b);
    }
    expect(batches.length).toBe(1);
    expect([...batches[0].records.keys()]).toEqual(["111", "222"]);
  });

  it("honors batchSize", async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, body: { data: [] } }]);
    const batches = [];
    for await (const b of fetchMany(["1", "2", "3", "4", "5", "6", "7"], {
      fetchImpl: fetch,
      batchSize: 3,
    })) {
      batches.push(b);
    }
    expect(calls.length).toBe(3); // 3 + 3 + 1
    expect(batches.map((b) => b.requested.length)).toEqual([3, 3, 1]);
  });

  it("retries on retryable status", async () => {
    const { fetch, calls } = fakeFetch([
      { status: 503 },
      { status: 200, body: { data: [makeRecord(111)] } },
    ]);
    const batches = [];
    for await (const b of fetchMany(["111"], { fetchImpl: fetch, maxAttempts: 3 })) {
      batches.push(b);
    }
    expect(calls.length).toBe(2);
    expect(batches[0].records.get("111")).toBeDefined();
  });

  it("raises on 4xx without retry", async () => {
    const { fetch, calls } = fakeFetch([{ status: 400 }]);
    await expect(async () => {
      for await (const _ of fetchMany(["111"], { fetchImpl: fetch, maxAttempts: 3 })) {
        void _;
      }
    }).rejects.toThrow(ICiteError);
    expect(calls.length).toBe(1);
  });

  it("raises on malformed payload", async () => {
    const { fetch } = fakeFetch([{ status: 200, body: ["not", "a", "dict"] }]);
    await expect(async () => {
      for await (const _ of fetchMany(["111"], { fetchImpl: fetch, maxAttempts: 1 })) {
        void _;
      }
    }).rejects.toThrow(ICiteError);
  });

  it("yields nothing for empty input", async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, body: { data: [] } }]);
    const batches = [];
    for await (const b of fetchMany([], { fetchImpl: fetch })) batches.push(b);
    expect(batches).toEqual([]);
    expect(calls.length).toBe(0);
  });
});
