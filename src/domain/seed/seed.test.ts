import { describe, expect, it } from "vitest";
import { PLATFORM_BY_ID } from "../platforms";
import { PROVIDER_BY_ID } from "../providers";
import { SEED_GAMES } from "./index";

describe("seed integrity", () => {
  it("has unique ids", () => {
    const ids = SEED_GAMES.map((g) => g.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("references only known platforms and providers", () => {
    for (const g of SEED_GAMES) {
      expect(PLATFORM_BY_ID[g.platformId], g.id).toBeDefined();
      expect(PROVIDER_BY_ID[g.providerId], g.id).toBeDefined();
    }
  });

  it("never marks a wishlist game as owned or installed", () => {
    for (const g of SEED_GAMES.filter((x) => x.status === "wishlist")) {
      expect(g.owned || g.installed, g.id).toBe(false);
    }
  });

  it("covers every platform family the user asked for", () => {
    const ps = new Set(SEED_GAMES.map((g) => g.platformId));
    for (const id of ["pc", "ps1", "ps2", "ps3", "ps4", "ps5", "xbox", "x360", "xone", "xsx", "switch"]) {
      expect(ps.has(id), id).toBe(true);
    }
  });
});

// Network check, opt-in: VITE_CHECK_COVERS=1 pnpm test
describe.runIf(import.meta.env["VITE_CHECK_COVERS"])("cover urls", () => {
  it("all resolve", { timeout: 300_000 }, async () => {
    const urls = [...new Set(SEED_GAMES.map((g) => g.coverUrl).filter((u): u is string => !!u))];
    const bad: string[] = [];
    for (let i = 0; i < urls.length; i += 8) {
      await Promise.all(
        urls.slice(i, i + 8).map(async (u) => {
          const r = await fetch(u, { method: "HEAD" }).catch(() => null);
          if (!r?.ok) bad.push(`${r?.status ?? "ERR"} ${u}`);
        }),
      );
    }
    expect(bad).toEqual([]);
  });
});
