import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useTasks } from "./tasks";

let useLibrary: typeof import("./library").useLibrary;

beforeAll(async () => {
  const storage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  ({ useLibrary } = await import("./library"));
});

afterAll(() => vi.unstubAllGlobals());

afterEach(() => {
  useTasks.getState().cancelAll();
  useLibrary.getState().reset();
  vi.useRealTimers();
});

describe("library task cancellation", () => {
  it("uninstalling during install prevents the game from being reinstalled", () => {
    vi.useFakeTimers();
    const game = useLibrary.getState().games.find((g) => g.owned && !g.installed)!;
    useLibrary.getState().installGame(game.id);
    useLibrary.getState().uninstallGame(game.id);
    vi.runAllTimers();
    expect(useLibrary.getState().games.find((g) => g.id === game.id)?.installed).toBe(false);
  });

  it("disconnecting cancels pending connect and sync jobs", () => {
    vi.useFakeTimers();
    const id = "steam";
    useLibrary.getState().connectProvider(id);
    useLibrary.getState().syncProvider(id);
    useLibrary.getState().disconnectProvider(id);
    vi.runAllTimers();
    expect(useLibrary.getState().providers[id]?.connected).toBe(false);
    expect(useLibrary.getState().providers[id]?.lastSync).toBeUndefined();
  });

  it("uninstalling an emulator cancels a pending install", () => {
    vi.useFakeTimers();
    const id = "retroarch";
    useLibrary.getState().installEmulator(id);
    useLibrary.getState().uninstallEmulator(id);
    vi.runAllTimers();
    expect(useLibrary.getState().emulators[id]).toBe(false);
  });

  it("restore cancels jobs from the prior library even when the restored id matches", () => {
    vi.useFakeTimers();
    const game = useLibrary.getState().games.find((g) => g.owned && !g.installed)!;
    useLibrary.getState().installGame(game.id);
    useLibrary.getState().restore({
      games: [{ ...game, installed: false }], scans: [], settings: { romsDir: "", emulatorsDir: "" },
      providers: {}, emulators: {},
    });
    vi.runAllTimers();
    expect(useTasks.getState().tasks).toEqual({});
    expect(useLibrary.getState().games.find((g) => g.id === game.id)?.installed).toBe(false);
  });

  it("reset cancels jobs from the prior library", () => {
    vi.useFakeTimers();
    const game = useLibrary.getState().games.find((g) => g.owned && !g.installed)!;
    useLibrary.getState().installGame(game.id);
    useLibrary.getState().reset();
    vi.runAllTimers();
    expect(useTasks.getState().tasks).toEqual({});
    expect(useLibrary.getState().games.find((g) => g.id === game.id)?.installed).toBe(false);
  });
});
