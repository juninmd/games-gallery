import { describe, expect, it } from "vitest";
import { PS_CRAWL_DELAY_MS, PS_MAX_PAGES, fetchPsPlusMonth } from "./freebiesApi";

const page = (title: string) => `<rss><channel><item><title>${title}</title><link>https://blog.playstation.com/p/</link><pubDate>Wed, 30 Sep 2026 15:00:00 +0000</pubDate></item></channel></rss>`;
const other = page("Some other post");
const monthly = page("PlayStation Plus Monthly Games for October: F1 25, Hunt: Showdown 1896");

function deps(pages: string[]) {
  const urls: string[] = [];
  const waits: number[] = [];
  return {
    urls, waits,
    get: async (u: string) => { urls.push(u); return pages[urls.length - 1] ?? other; },
    wait: async (ms: number) => { waits.push(ms); },
  };
}

describe("fetchPsPlusMonth", () => {
  it("stops at the first page that has the monthly post and waits between requests only", async () => {
    const d = deps([other, other, monthly, monthly]);
    const seen: number[] = [];
    const month = await fetchPsPlusMonth((p) => seen.push(p), d);
    expect(month?.games).toEqual(["F1 25", "Hunt: Showdown 1896"]);
    expect(d.urls).toEqual([
      "https://blog.playstation.com/feed/",
      "https://blog.playstation.com/feed/?paged=2",
      "https://blog.playstation.com/feed/?paged=3",
    ]);
    expect(d.waits).toEqual([PS_CRAWL_DELAY_MS, PS_CRAWL_DELAY_MS]);
    expect(seen).toEqual([1, 2, 3]);
  });
  it("gives up after the page cap without hammering the host", async () => {
    const d = deps([]);
    expect(await fetchPsPlusMonth(undefined, d)).toBeNull();
    expect(d.urls).toHaveLength(PS_MAX_PAGES);
    expect(d.waits).toHaveLength(PS_MAX_PAGES - 1);
  });
  it("propagates a network failure instead of looping on it", async () => {
    const d = { ...deps([]), get: async () => { throw new Error("HTTP 503"); } };
    await expect(fetchPsPlusMonth(undefined, d)).rejects.toThrow("HTTP 503");
  });
});
