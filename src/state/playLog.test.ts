import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const mem = new Map<string, string>();
  const localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  Object.assign(globalThis, { localStorage, window: { localStorage } });
});

import type { Game } from "../domain/types";
import { useLibrary } from "./library";
import { usePlayLog, watchPlayLog } from "./playLog";

const game = (id: string, playtimeH: number): Game => ({
  id, title: id, platformId: "pc", providerId: "steam", year: 2020, genres: [], status: "backlog", owned: true, installed: false, playtimeH,
});

let stop = () => undefined as void;
beforeEach(() => {
  usePlayLog.setState({ log: [] });
  useLibrary.setState({ games: [game("a", 10), game("b", 2)] });
  stop = watchPlayLog();
});
afterEach(() => stop());

describe("watchPlayLog", () => {
  it("logs growth in hours, and only growth", () => {
    useLibrary.setState({ games: [game("a", 12.5), game("b", 1)] });
    expect(usePlayLog.getState().log).toMatchObject([{ title: "a", h: 2.5 }]);
  });
  it("treats a newly added game as a baseline, not as play", () => {
    useLibrary.setState({ games: [game("a", 10), game("b", 2), game("c", 300)] });
    expect(usePlayLog.getState().log).toEqual([]);
    useLibrary.setState({ games: [game("a", 10), game("b", 2), game("c", 301)] });
    expect(usePlayLog.getState().log).toMatchObject([{ title: "c", h: 1 }]);
  });
  it("does not read a backup restore or a reset as play time", () => {
    useLibrary.getState().restore({ games: [game("a", 500), game("b", 900)], scans: [], settings: {} });
    expect(usePlayLog.getState().log).toEqual([]);
    useLibrary.setState({ games: [game("a", 501), game("b", 900)] });
    expect(usePlayLog.getState().log).toMatchObject([{ title: "a", h: 1 }]);
    useLibrary.getState().reset();
    expect(usePlayLog.getState().log).toHaveLength(1);
  });
  it("stops after unsubscribing", () => {
    stop();
    useLibrary.setState({ games: [game("a", 99), game("b", 2)] });
    expect(usePlayLog.getState().log).toEqual([]);
  });
});
