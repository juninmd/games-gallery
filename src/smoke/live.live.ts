import { describe, expect, it } from "vitest";
import { fetchWishlist } from "../platform/dealsApi";
import { runProbe, type ProbeId } from "../platform/probes";

// Node has no CORS and no Tauri HTTP plugin: a plain fetch stands in for `httpGetJson`.
const get = async (url: string): Promise<unknown> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
const ctx = { steamId: "", steamKey: "", rawgKey: "" };

describe("live store contracts (parsers vs real payloads)", () => {
  const keyless: ProbeId[] = ["steam-store", "steam-reviews", "gog", "epic"];
  for (const id of keyless) {
    it(`${id} answers in the shape the app parses`, async () => {
      const r = await runProbe(id, ctx, get);
      expect(r, r.detail).toMatchObject({ ok: true });
    });
  }

  it("steam wishlist endpoint accepts a SteamID and the browse endpoint prices the items", async () => {
    // Valve's own public account: the call itself must succeed, even if the list is private/empty.
    const out = await fetchWishlist("76561197960287930", "", get);
    expect(Array.isArray(out)).toBe(true);
  });
});
