import { describe, expect, it, vi } from "vitest";
import { fileStorage, type StateBackend } from "./stateStorage";

function backend(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial));
  const writes: string[] = [];
  let release: (() => void) | undefined;
  const api: StateBackend = {
    read: async (k) => files.get(k) ?? null,
    write: (k, v) => new Promise<void>((resolve) => {
      writes.push(v);
      release = () => { files.set(k, v); resolve(); };
    }),
    remove: async (k) => { files.delete(k); },
  };
  return { api, files, writes, flush: () => release?.() };
}

const legacy = (data: Record<string, string>) => () => ({ getItem: (k: string) => data[k] ?? null }) as unknown as Storage;

describe("fileStorage", () => {
  it("prefers the file and falls back to localStorage once, without deleting it", async () => {
    const old = { k: "old" };
    expect(await fileStorage(backend({ k: "file" }).api, legacy(old)).getItem("k")).toBe("file");
    expect(await fileStorage(backend().api, legacy(old)).getItem("k")).toBe("old");
    expect(old.k).toBe("old");
  });

  it("drops writes made before the key was read, so hydration cannot be clobbered", async () => {
    const b = backend({ k: "saved" });
    const s = fileStorage(b.api, legacy({}));
    s.setItem("k", "empty initial state");
    expect(b.writes).toEqual([]);
    await s.getItem("k");
    s.setItem("k", "real");
    expect(b.writes).toEqual(["real"]);
  });

  it("serializes writes per key and keeps only the latest pending value", async () => {
    const b = backend();
    const s = fileStorage(b.api, legacy({}));
    await s.getItem("k");
    const first = s.setItem("k", "1");
    s.setItem("k", "2");
    s.setItem("k", "3");
    expect(b.writes).toEqual(["1"]);
    b.flush();
    await vi.waitFor(() => expect(b.writes).toEqual(["1", "3"]));
    b.flush();
    await first;
    expect(b.files.get("k")).toBe("3");
  });

  it("an unreadable file falls back to localStorage and blocks writes over it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const writes: string[] = [];
    const s = fileStorage({ read: async () => { throw new Error("EACCES"); }, remove: async () => {}, write: async (_k, v) => { writes.push(v); } }, legacy({ k: "old" }));
    expect(await s.getItem("k")).toBe("old");
    s.setItem("k", "new");
    expect(writes).toEqual([]);
    expect(err).toHaveBeenCalledOnce();
    err.mockRestore();
  });

  it("a failed write is logged and does not block the next one", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const writes: string[] = [];
    const s = fileStorage({ read: async () => null, remove: async () => {}, write: async (_k, v) => { writes.push(v); if (v === "bad") throw new Error("disk full"); } }, legacy({}));
    await s.getItem("k");
    await s.setItem("k", "bad");
    await s.setItem("k", "good");
    expect(writes).toEqual(["bad", "good"]);
    expect(err).toHaveBeenCalledOnce();
    err.mockRestore();
  });
});
