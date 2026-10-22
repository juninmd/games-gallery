import { describe, expect, it } from "vitest";
import { resolveRequestUrl } from "./http";

describe("resolveRequestUrl", () => {
  it("routes allowed hosts through the dev proxy in the browser", () => {
    expect(resolveRequestUrl("https://store.steampowered.com/appreviews/620?json=1", false)).toBe("/proxy/steam/appreviews/620?json=1");
  });

  it("keeps the real URL under Tauri (the HTTP plugin scope is the allow-list)", () => {
    const u = "https://api.rawg.io/api/games?search=hades";
    expect(resolveRequestUrl(u, true)).toBe(u);
  });

  it("rejects unknown hosts, plain http and lookalike hosts", () => {
    for (const bad of ["https://evil.example/x", "http://store.steampowered.com/x", "https://store.steampowered.com.evil.io/x", "https://api.rawg.io@evil.io/x"]) {
      expect(() => resolveRequestUrl(bad, false), bad).toThrow();
    }
  });
});
