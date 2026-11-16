import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { game } from "../domain/gameFactory";

let useSessions: typeof import("./sessions").useSessions;
let useLibrary: typeof import("./library").useLibrary;

beforeAll(async () => {
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  ({ useSessions } = await import("./sessions"));
  ({ useLibrary } = await import("./library"));
});

afterAll(() => vi.unstubAllGlobals());

describe("play sessions", () => {
  it("an emulator exit records the session and adds its time to the game's hours", () => {
    const g = { ...game("snes", "roms", "Chrono Trigger", 1995, "RPG"), playtimeH: 1 };
    useLibrary.getState().addGame(g);
    useSessions.getState().started(g.id, 4242, 0);
    useSessions.getState().finished(4242, 90 * 60_000);
    expect(useSessions.getState().sessions[0]).toMatchObject({ gameId: g.id, minutes: 90, kind: "exec" });
    expect(useSessions.getState().running).toEqual({});
    expect(useLibrary.getState().games.find((x) => x.id === g.id)?.playtimeH).toBe(2.5);
  });
  it("an exit for a pid the app did not start changes nothing", () => {
    const before = useSessions.getState().sessions.length;
    useSessions.getState().finished(1);
    expect(useSessions.getState().sessions.length).toBe(before);
  });
  it("a store launch only records when it started (the launcher owns the process)", () => {
    useSessions.getState().opened("steam-1", Date.parse("2026-11-02T10:00:00Z"));
    expect(useSessions.getState().sessions[0]).toEqual({ gameId: "steam-1", start: "2026-11-02T10:00:00.000Z", kind: "uri" });
  });
});
