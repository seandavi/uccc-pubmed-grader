import { describe, expect, it } from "vitest";

import { fetchUnpaywall } from "../unpaywall";

function fakeFetch(handler: (url: string) => { status: number; body?: unknown }) {
  const calls: string[] = [];
  const impl: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    const r = handler(url);
    return new Response(JSON.stringify(r.body ?? {}), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { impl, calls };
}

describe("fetchUnpaywall", () => {
  it("returns is_oa + oa_status per DOI", async () => {
    // URLs are %-encoded, so match the encoded form.
    const oaEncoded = encodeURIComponent("10.1/oa");
    const { impl } = fakeFetch((u) => {
      if (u.includes(oaEncoded)) {
        return {
          status: 200,
          body: {
            is_oa: true,
            oa_status: "gold",
            best_oa_location: { url_for_pdf: "https://x/pdf" },
          },
        };
      }
      return { status: 200, body: { is_oa: false, oa_status: "closed", best_oa_location: null } };
    });
    const out = await fetchUnpaywall(["10.1/oa", "10.1/closed"], { fetchImpl: impl });
    expect(out.get("10.1/oa")?.isOA).toBe(true);
    expect(out.get("10.1/oa")?.oaStatus).toBe("gold");
    expect(out.get("10.1/oa")?.bestOAUrl).toBe("https://x/pdf");
    expect(out.get("10.1/closed")?.isOA).toBe(false);
    expect(out.get("10.1/closed")?.oaStatus).toBe("closed");
  });

  it("treats 404 as 'no data', not an error", async () => {
    const { impl } = fakeFetch(() => ({ status: 404 }));
    const out = await fetchUnpaywall(["10.1/unknown"], { fetchImpl: impl });
    expect(out.size).toBe(0);
  });

  it("skips DOIs that don't start with 10.", async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: { is_oa: true, oa_status: "gold" } }));
    const out = await fetchUnpaywall(["not-a-doi", ""], { fetchImpl: impl });
    expect(out.size).toBe(0);
    expect(calls.length).toBe(0);
  });

  it("calls onProgress per completed item", async () => {
    const { impl } = fakeFetch(() => ({ status: 200, body: { is_oa: true, oa_status: "gold" } }));
    const seen: number[] = [];
    await fetchUnpaywall(["10.1/a", "10.1/b", "10.1/c"], {
      fetchImpl: impl,
      concurrency: 1,
      onProgress: (p) => seen.push(p),
    });
    expect(seen).toEqual([1, 2, 3]);
  });

  it("coerces unknown oa_status to 'unknown'", async () => {
    const { impl } = fakeFetch(() => ({ status: 200, body: { is_oa: true, oa_status: "weird" } }));
    const out = await fetchUnpaywall(["10.1/x"], { fetchImpl: impl });
    expect(out.get("10.1/x")?.oaStatus).toBe("unknown");
  });
});
