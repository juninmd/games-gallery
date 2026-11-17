import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { isTauri } from "./runtime";

/** What the file storage needs from the Rust side; injected so it is testable without Tauri. */
export interface StateBackend {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

/**
 * File-backed storage (docs/adr/0001). The first read falls back to localStorage so existing data
 * moves over on its own; localStorage is left untouched, which keeps a downgrade possible.
 * Writes per key are serialized and coalesced: only the latest pending value is written. A write
 * before the key was read is dropped: zustand saves on every set, even before an async hydration,
 * and that would overwrite the saved library with the empty initial state.
 */
export function fileStorage(backend: StateBackend, legacy: () => Storage | undefined): StateStorage<Promise<void> | void> {
  const pending = new Map<string, string>();
  const running = new Set<string>();
  const loaded = new Set<string>();

  const drain = async (key: string): Promise<void> => {
    running.add(key);
    try {
      for (let value = pending.get(key); value !== undefined; value = pending.get(key)) {
        pending.delete(key);
        await backend.write(key, value).catch((e: unknown) => console.error(`Falha ao salvar ${key}`, e));
      }
    } finally {
      running.delete(key);
    }
  };

  return {
    getItem: async (key) => {
      const fromLegacy = () => { try { return legacy()?.getItem(key) ?? null; } catch { return null; } };
      let stored: string | null;
      try {
        stored = await backend.read(key);
      } catch (e) {
        // Unreadable file: keep writes blocked so it is not replaced; the app runs on the old copy.
        console.error(`Falha ao ler ${key}; alterações desta sessão não serão salvas`, e);
        return fromLegacy();
      }
      loaded.add(key);
      return stored ?? fromLegacy();
    },
    setItem: (key, value) => {
      if (!loaded.has(key)) return;
      pending.set(key, value);
      if (!running.has(key)) return drain(key);
    },
    removeItem: (key) => {
      pending.delete(key);
      return backend.remove(key);
    },
  };
}

async function invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

const tauriBackend: StateBackend = {
  read: (key) => invoke<string | null>("state_read", { key }),
  write: (key, value) => invoke("state_write", { key, value }),
  remove: (key) => invoke("state_remove", { key }),
};

const legacyStorage = () => (typeof localStorage === "undefined" ? undefined : localStorage);

/** Installed app: files in the app data folder. Browser (`pnpm dev`) and tests: localStorage, synchronous. */
export const appStorage = () =>
  createJSONStorage(() => (isTauri() ? fileStorage(tauriBackend, legacyStorage) : localStorage));
