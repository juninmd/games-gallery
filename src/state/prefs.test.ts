import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensurePermission, storage } = vi.hoisted(() => {
  const mem = new Map<string, string>();
  const localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  Object.assign(globalThis, { localStorage, window: { localStorage } });
  return { ensurePermission: vi.fn(), storage: mem };
});
vi.mock("../platform/notify", () => ({ ensurePermission, notifyNative: vi.fn() }));

import { usePrefs } from "./prefs";

beforeEach(() => {
  ensurePermission.mockReset();
  storage.clear();
  usePrefs.setState({ notifications: false, gamepadNav: false, announcedHits: [], seenFreebies: undefined });
});

describe("opt-in switches", () => {
  it("start off, so a connected controller or a fresh install never acts on its own", () => {
    expect(usePrefs.getState()).toMatchObject({ notifications: false, gamepadNav: false });
  });

  it("only a literal true survives a reload, so tampered storage cannot switch them on", async () => {
    storage.set("games-gallery:prefs:v1", JSON.stringify({ version: 1, state: { notifications: "yes", gamepadNav: 1, announcedHits: ["a", 3, ""], seenFreebies: "x" } }));
    await usePrefs.persist.rehydrate();
    expect(usePrefs.getState()).toMatchObject({ notifications: false, gamepadNav: false, announcedHits: ["a"], seenFreebies: undefined });

    storage.set("games-gallery:prefs:v1", JSON.stringify({ version: 1, state: { notifications: true, gamepadNav: true } }));
    await usePrefs.persist.rehydrate();
    expect(usePrefs.getState()).toMatchObject({ notifications: true, gamepadNav: true });
  });
});

describe("setNotifications", () => {
  it("turns on only when the OS grants permission, and reports the refusal", async () => {
    ensurePermission.mockResolvedValueOnce(false);
    expect(await usePrefs.getState().setNotifications(true)).toBe(false);
    expect(usePrefs.getState().notifications).toBe(false);

    ensurePermission.mockResolvedValueOnce(true);
    expect(await usePrefs.getState().setNotifications(true)).toBe(true);
    expect(usePrefs.getState().notifications).toBe(true);
  });

  it("turning off never asks the OS for anything", async () => {
    usePrefs.setState({ notifications: true });
    expect(await usePrefs.getState().setNotifications(false)).toBe(true);
    expect(usePrefs.getState().notifications).toBe(false);
    expect(ensurePermission).not.toHaveBeenCalled();
  });
});
