import { describe, expect, it } from "vitest";

import { fetchAltmetric } from "../altmetric";

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

describe("fetchAltmetric", () => {
  it("returns score and details_url per PMID", async () => {
    const { impl } = fakeFetch((u) => {
      if (u.endsWith("/111")) {
        return { status: 200, body: { score: 42.5, details_url: "https://altmetric.com/x" } };
      }
      return { status: 404 };
    });
    const out = await fetchAltmetric(["111", "222"], { fetchImpl: impl });
    expect(out.get("111")).toEqual({
      pmid: "111",
      score: 42.5,
      detailsUrl: "https://altmetric.com/x",
    });
    expect(out.has("222")).toBe(false);
  });

  it("treats 403 as 'no data', not an error", async () => {
    const { impl } = fakeFetch(() => ({ status: 403 }));
    const out = await fetchAltmetric(["111"], { fetchImpl: impl });
    expect(out.size).toBe(0);
  });

  it("skips records without a numeric score", async () => {
    const { impl } = fakeFetch(() => ({ status: 200, body: { score: null } }));
    const out = await fetchAltmetric(["111"], { fetchImpl: impl });
    expect(out.size).toBe(0);
  });
});
