import { describe, expect, it } from "vitest";
import { combineDetections, detectionSummary, importItemsFrom, mergeDetections, safeStoreId } from "./detect";
import { game } from "./gameFactory";
import type { DetectedEntry, ProviderDetection } from "./types";

const entry = (storeId: string, title: string, installed = true, playtimeH?: number): DetectedEntry => ({
  storeId, title, installed, playtimeH,
});

describe("mergeDetections", () => {
  it("keeps the local installed flag and size, and adds playtime from the API", () => {
    const local = [{ ...entry("440", "Team Fortress 2", true), sizeGb: 33.2 }];
    const remote = [entry("440", "Team Fortress 2", false, 120.5), entry("620", "Portal 2", false, 4)];
    const merged = mergeDetections(local, remote);
    const tf2 = merged.find((g) => g.storeId === "440");
    expect(tf2).toMatchObject({ installed: true, sizeGb: 33.2, playtimeH: 120.5 });
    expect(merged.find((g) => g.storeId === "620")).toMatchObject({ installed: false, playtimeH: 4 });
  });

  it("never marks an API-only game as installed", () => {
    const merged = mergeDetections([], [entry("620", "Portal 2", true)]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.installed).toBe(false);
  });
});

describe("importItemsFrom", () => {
  it("creates Steam games with cover art and the store id from the manifest", () => {
    const items = importItemsFrom(
      { providerId: "steam", source: "appmanifest", available: true, games: [entry("1145360", "Hades")] },
      [],
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "new", title: "Hades" });
    expect(items[0]!.game).toMatchObject({
      providerId: "steam",
      installed: true,
      storeId: "1145360",
      steamAppId: 1145360,
      coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/library_600x900.jpg",
    });
  });

  it("links an existing game by Steam app id instead of duplicating it", () => {
    const existing = game("pc", "steam", "Hades", 2020, "Roguelike", { store: 1145360, i: false });
    const items = importItemsFrom(
      { providerId: "steam", source: "appmanifest", available: true, games: [entry("1145360", "Hades")] },
      [existing],
    );
    expect(items[0]).toMatchObject({ kind: "link", gameId: existing.id });
    expect(items[0]!.patch).toMatchObject({ installed: true, owned: true });
  });

  it("maps Epic manifests to Epic store ids", () => {
    const items = importItemsFrom(
      { providerId: "epic", source: "*.item", available: true, games: [entry("BatfishS2", "Telltale Batman Season 2")] },
      [],
    );
    expect(items[0]!.game).toMatchObject({ providerId: "epic", storeId: "BatfishS2", installed: true });
  });

  it("creates GOG games with the numeric store id and links them later", () => {
    const detection = { providerId: "gog", source: "galaxy-2.0.db", available: true, games: [entry("1207659061", "Worlds of Ultima")] };
    const created = importItemsFrom(detection, []);
    expect(created[0]!.game).toMatchObject({ providerId: "gog", storeId: "1207659061", installed: true });

    const again = importItemsFrom(detection, created.map((i) => i.game!));
    expect(again[0]).toMatchObject({ kind: "same" });
  });
});

describe("detectionSummary", () => {
  it("reports each source with its count and handles an empty scan", () => {
    expect(detectionSummary([{ providerId: "steam", source: "s", available: true, games: [entry("1", "A")] }])).toContain("steam (1)");
    expect(detectionSummary([{ providerId: "steam", source: "s", available: false, note: "nope", games: [] }])).toContain("Nenhuma");
  });
});

describe("combineDetections", () => {
  const mk = (providerId: string, available: boolean, games: DetectedEntry[]) => ({ providerId, source: "s", available, games }) as ProviderDetection;
  it("merges scanners of one provider: one entry per store id, installed wins, details kept", () => {
    const out = combineDetections([
      mk("epic", true, [{ ...entry("App1", "App One", true), sizeGb: 3 }]),
      mk("epic", false, []),
      mk("epic", true, [entry("App1", "App One (account)", false), entry("App2", "App Two", false)]),
      mk("gog", true, [entry("1", "G", false)]),
    ]);
    const epic = out.find((d) => d.providerId === "epic");
    expect(out.map((d) => d.providerId)).toEqual(["epic", "gog"]);
    expect(epic?.games).toHaveLength(2);
    expect(epic?.games.find((g) => g.storeId === "App1")).toMatchObject({ title: "App One", installed: true, sizeGb: 3 });
  });
  it("does not plan the same game twice when two scanners report it", () => {
    const merged = combineDetections([mk("epic", true, [entry("App1", "App One", true)]), mk("epic", true, [entry("App1", "App One", false)])]);
    const items = merged.flatMap((d) => importItemsFrom(d, []));
    expect(items.filter((i) => i.kind !== "same")).toHaveLength(1);
  });
  it("treats the same title under two store ids as one game (Ubisoft registry id vs account space id)", () => {
    const [ubi] = combineDetections([mk("ubisoft", true, [entry("5", "Far Cry 5", true)]), mk("ubisoft", true, [entry("aaaa-bbbb", "Far Cry® 5", false)])]);
    expect(ubi?.games).toEqual([expect.objectContaining({ storeId: "5", installed: true })]);
  });
});

describe("importItemsFrom keeps installed=false for owned-only games", () => {
  const det = (providerId: string, games: DetectedEntry[]) => ({ providerId, source: "s", available: true, games }) as ProviderDetection;
  for (const [providerId, id] of [["steam", "620"], ["epic", "AppX"]] as const) {
    it(`${providerId}: a new owned-only game is not marked installed`, () => {
      const [item] = importItemsFrom(det(providerId, [entry(id, "Owned Only", false)]), []);
      expect(item?.kind).toBe("new");
      expect(item?.game?.installed).toBe(false);
      expect(item?.game?.owned).toBe(true);
    });
    it(`${providerId}: an owned-only report does not flip an existing game's installed flag`, () => {
      const existing = { ...game("pc", providerId, "Owned Only", 2020, "", { store: id, i: true, ...(providerId === "steam" ? { steamAppId: 620 } : {}) }) };
      const items = importItemsFrom(det(providerId, [entry(id, "Owned Only", false)]), [existing]);
      expect(items[0]?.kind).toBe("same");
      expect(items[0]?.patch).not.toHaveProperty("installed", false);
    });
    it(`${providerId}: an existing not-installed game stays not installed after an owned-only report`, () => {
      const existing = game("pc", providerId, "Owned Only", 2020, "", { store: id, i: false, ...(providerId === "steam" ? { steamAppId: 620 } : {}) });
      const [item] = importItemsFrom(det(providerId, [entry(id, "Owned Only", false)]), [existing]);
      expect(item?.patch?.installed).not.toBe(true);
    });
    it(`${providerId}: an installed report still marks installed`, () => {
      const [item] = importItemsFrom(det(providerId, [entry(id, "Installed One", true)]), []);
      expect(item?.game?.installed).toBe(true);
    });
  }
});

describe("combineDetections never merges different store ids by title for id-stable providers", () => {
  const mk = (providerId: string, games: DetectedEntry[]) => ({ providerId, source: "s", available: true, games }) as ProviderDetection;
  it("keeps two Steam apps that share a title", () => {
    const [steam] = combineDetections([mk("steam", [entry("3970", "Prey", false), entry("480490", "Prey", true)])]);
    expect(steam?.games.map((g) => g.storeId).sort()).toEqual(["3970", "480490"]);
  });
  it("never merges titles that fold to nothing", () => {
    const [ubi] = combineDetections([mk("ubisoft", [entry("1", "™", true), entry("2", "®", false)])]);
    expect(ubi?.games).toHaveLength(2);
  });
});

describe("safeStoreId", () => {
  it("keeps ids the app already accepts and slugs the rest deterministically", () => {
    expect(safeStoreId("Origin.OFR.50.0000461")).toBe("Origin.OFR.50.0000461");
    expect(safeStoreId("Baba Is You")).toBe("Baba-Is-You");
    expect(safeStoreId("OFB-EAST:109547519")).toBe("OFB-EAST-109547519");
    expect(safeStoreId("Baba Is You")).toBe(safeStoreId("Baba Is You"));
  });
  it("never returns something that fails the store-id rule, even for symbol-only input", () => {
    for (const raw of ["™", "../x", "a b/c", "", "   "]) expect(safeStoreId(raw)).toMatch(/^[\w.-]+$/);
  });
});
