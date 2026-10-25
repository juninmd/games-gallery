import { describe, expect, it, vi } from "vitest";
import type { Game } from "../types";
import { isEpicItemPath, isLegendaryInstalledPath, MAX_EPIC_ITEM_BYTES, parseEpicItem, parseLegendaryInstalled, scanEpicMetadata } from "./epic";
import { planEpicImport } from "./plan";

const game = (over: Partial<Game>): Game => ({
  id: "g", title: "Example", platformId: "pc", providerId: "epic", year: 2020, genres: [],
  status: "backlog", owned: true, installed: false, playtimeH: 0, ...over,
});
const itemText = (over: Record<string, unknown> = {}) => JSON.stringify({
  AppName: "ExampleApp-123", DisplayName: "Example Game", InstallLocation: "Z:/external/install",
  InstallSize: 1_073_741_824, bIsApplication: false, bIsExecutable: false, ...over,
});

describe("Epic metadata parsing", () => {
  it("accepts native launcher items using only the known install fields", () => {
    expect(parseEpicItem(itemText({ userToken: "must-not-escape" }))).toEqual({
      kind: "entry", entry: { appName: "ExampleApp-123", title: "Example Game", sizeGb: 1, needsVerification: false, source: "item" },
    });
  });

  it("skips DLC and incomplete items without inferring DLC from unknown flags", () => {
    expect(parseEpicItem(itemText({ MainGameAppName: "BaseGame" }))).toEqual({ kind: "skip", reason: "dlc" });
    expect(parseEpicItem(itemText({ bIsIncompleteInstall: true }))).toEqual({ kind: "skip", reason: "incomplete" });
    expect(parseEpicItem(itemText({ bIsApplication: false, bIsExecutable: false })).kind).toBe("entry");
  });

  it("rejects malformed or unsafe required identifiers and sizes", () => {
    expect(parseEpicItem("not json")).toEqual({ kind: "skip", reason: "invalid" });
    expect(parseEpicItem(itemText({ AppName: "../secret" }))).toEqual({ kind: "skip", reason: "invalid" });
    expect(parseEpicItem(itemText({ InstallLocation: " " }))).toEqual({ kind: "skip", reason: "invalid" });
    expect(parseEpicItem(itemText({ InstallSize: -1 }))).toEqual({ kind: "skip", reason: "invalid" });
  });

  it("includes verification-needed Legendary records and omits DLC", () => {
    const parsed = parseLegendaryInstalled(JSON.stringify({
      "GameA": { app_name: "GameA", title: "Game A", install_path: "E:/games/a", install_size: 0, needs_verification: true, executable: "ignore me", user_token: "secret" },
      "DlcA": { app_name: "DlcA", title: "Game A DLC", install_path: "E:/games/dlc", is_dlc: true },
    }));
    expect(parsed).toEqual({
      entries: [{ appName: "GameA", title: "Game A", sizeGb: 0, needsVerification: true, source: "legendary" }],
      invalid: 0, dlc: 1,
    });
    expect(parseLegendaryInstalled("[malformed")).toBeNull();
    expect(parseLegendaryInstalled(JSON.stringify({ game: { app_name: "Game", title: "Game", install_path: "x", install_size: -5 } }))).toMatchObject({ entries: [], invalid: 1 });
  });

  it("allow-lists only `.item` and an exact installed.json basename", () => {
    expect(isEpicItemPath("Manifests/Game.item")).toBe(true);
    expect(isEpicItemPath("Manifests/Game.item.bak")).toBe(false);
    expect(isLegendaryInstalledPath("config/installed.json")).toBe(true);
    expect(isLegendaryInstalledPath("config/user.json")).toBe(false);
    expect(isLegendaryInstalledPath("config/installed.json.bak")).toBe(false);
  });

  it("reads only allow-listed files, enforces file-size caps before reading, and reports invalid records safely", async () => {
    const readText = vi.fn(async (path: string) => path.endsWith("Good.item") ? itemText() : "contents must not appear in notes");
    const fileSize = vi.fn(async (path: string) => path.endsWith("Huge.item") ? MAX_EPIC_ITEM_BYTES + 1 : 20);
    const result = await scanEpicMetadata({
      files: ["Manifests/Good.item", "Manifests/Huge.item", "config/user.json", "config/installed.json.bak", "config/installed.json"],
      readText, fileSize,
    });
    expect(readText.mock.calls.map(([path]) => path)).toEqual(["Manifests/Good.item", "config/installed.json"]);
    expect(fileSize.mock.calls.map(([path]) => path)).toEqual(["Manifests/Good.item", "Manifests/Huge.item", "config/installed.json"]);
    expect(result.entries.map((entry) => entry.appName)).toEqual(["ExampleApp-123"]);
    expect(result.notes.join(" ")).toContain("excederam o limite de tamanho");
    expect(result.notes.join(" ")).not.toContain("contents must not appear");
  });

  it("stops before exceeding the aggregate metadata byte budget", async () => {
    const files = Array.from({ length: 70 }, (_, index) => `Manifests/${String(index).padStart(2, "0")}.item`);
    const readText = vi.fn(async () => "{}");
    const result = await scanEpicMetadata({ files, readText, fileSize: async () => MAX_EPIC_ITEM_BYTES });
    expect(readText).toHaveBeenCalledTimes(64);
    expect(result.notes.join(" ")).toContain("6 arquivo(s) não lidos");
  });
});

describe("planEpicImport", () => {
  const record = (over: Partial<{ appName: string; title: string; sizeGb: number; needsVerification: boolean; source: "item" | "legendary" }> = {}) => ({
    appName: "ExampleApp-123", title: "Example Game", sizeGb: 2, needsVerification: false, source: "item" as const, ...over,
  });

  it("links by exact Epic app id and preserves user fields while promoting a wishlist", () => {
    const owned = game({ id: "owned", title: "My title", providerId: "epic", storeId: "ExampleApp-123", status: "wishlist", owned: false, installed: false, notes: "my note", rating: 4, playtimeH: 77 });
    const [planned] = planEpicImport([record()], [owned]);
    expect(planned).toMatchObject({ kind: "link", gameId: "owned", patch: { owned: true, installed: true, status: "backlog", sizeGb: 2 } });
    expect(planned?.patch).not.toHaveProperty("notes");
    const updated = { ...owned, ...planned?.patch };
    expect(updated).toMatchObject({ notes: "my note", rating: 4, playtimeH: 77 });
  });

  it("uses title fallback only for Epic PC entries without IDs, preserving first-hit semantics", () => {
    const first = game({ id: "first", title: "Éxample Game", providerId: "epic", storeId: undefined });
    const second = game({ id: "second", title: "Example Game", providerId: "epic", storeId: undefined });
    const [planned] = planEpicImport([record()], [first, second]);
    expect(planned).toMatchObject({ kind: "link", gameId: "first", patch: { storeId: "ExampleApp-123" } });
  });

  it("never title-links another store or overwrites a different Epic app id", () => {
    const games = [
      game({ id: "steam", title: "Example Game", providerId: "steam", storeId: "steam-9" }),
      game({ id: "gog", title: "Example Game", providerId: "gog", storeId: "gog-9" }),
      game({ id: "epic-other", title: "Example Game", providerId: "epic", storeId: "DifferentEpicId" }),
    ];
    const [planned] = planEpicImport([record()], games);
    expect(planned?.kind).toBe("new");
    expect(planned?.game).toMatchObject({ providerId: "epic", storeId: "ExampleApp-123" });
  });

  it("deduplicates duplicate records and gives deterministic collision-safe IDs", () => {
    const records = [record(), record({ source: "legendary" })];
    const planned = planEpicImport(records, [game({ id: "epic-pc-example-game", title: "Other", providerId: "steam" })]);
    expect(planned).toHaveLength(1);
    expect(planned[0]?.game?.id).toBe("epic-pc-example-game-2");
  });
});
