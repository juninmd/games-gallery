import { describe, expect, it } from "vitest";
import { game, gameId } from "./gameFactory";

describe("gameId", () => {
  it("keeps the readable slug for latin titles (existing saved ids must not change)", () => {
    expect(gameId("pc", "steam", "Pokémon: Showdown™")).toBe("steam-pc-pokemon-showdown");
    expect(gameId("ps2", "roms", "God of War II")).toBe("roms-ps2-god-of-war-ii");
  });

  it("gives different ids to titles the slug cannot represent", () => {
    const a = gameId("pc", "steam", "原神");
    const b = gameId("pc", "steam", "崩坏");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^steam-pc-[0-9a-z]+$/);
    expect(gameId("pc", "steam", "😀")).not.toBe(gameId("pc", "steam", "🎮"));
  });

  it("is stable for the same title and ignores surrounding whitespace", () => {
    expect(gameId("pc", "steam", " 原神 ")).toBe(gameId("pc", "steam", "原神"));
  });
});

describe("game", () => {
  it("wishlist entries are never owned or installed", () => {
    const g = game("pc", "steam", "Hades", 2020, "Roguelike, Action", { s: "wishlist", i: true });
    expect(g.owned).toBe(false);
    expect(g.installed).toBe(false);
    expect(g.genres).toEqual(["Roguelike", "Action"]);
  });

  it("two CJK games in the same store keep separate library entries", () => {
    expect(game("pc", "steam", "原神", 2020, "RPG").id).not.toBe(game("pc", "steam", "崩坏", 2020, "RPG").id);
  });
});
