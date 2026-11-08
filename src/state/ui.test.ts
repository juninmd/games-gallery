import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();
const storage = {
  getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => { values.set(k, v); },
  removeItem: (k: string) => { values.delete(k); },
};

beforeEach(() => {
  values.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", storage);
});

describe("grid density", () => {
  it("defaults to comfortable and remembers the choice across reloads", async () => {
    const { useUi } = await import("./ui");
    expect(useUi.getState().density).toBe("comfortable");
    useUi.getState().setDensity("compact");
    expect(values.get("games-gallery:density")).toBe("compact");
    vi.resetModules();
    const again = await import("./ui");
    expect(again.useUi.getState().density).toBe("compact");
  });

  it("remembers the boxes shelf view", async () => {
    const { useUi } = await import("./ui");
    useUi.getState().setDensity("boxes");
    vi.resetModules();
    const again = await import("./ui");
    expect(again.useUi.getState().density).toBe("boxes");
  });

  it("ignores a tampered stored value", async () => {
    values.set("games-gallery:density", "<script>");
    const { useUi } = await import("./ui");
    expect(useUi.getState().density).toBe("comfortable");
  });

  it("still works in memory when storage throws", async () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    const { useUi } = await import("./ui");
    expect(useUi.getState().density).toBe("comfortable");
    useUi.getState().setDensity("compact");
    expect(useUi.getState().density).toBe("compact");
  });
});

describe("shortcuts help", () => {
  it("opens and closes", async () => {
    const { useUi } = await import("./ui");
    expect(useUi.getState().shortcutsOpen).toBe(false);
    useUi.getState().setShortcutsOpen(true);
    expect(useUi.getState().shortcutsOpen).toBe(true);
  });
});
