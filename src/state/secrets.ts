import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type VaultName, vaultAvailable, vaultDelete, vaultGet, vaultSet } from "../platform/vault";

/**
 * API keys (Steam Web API, RAWG) are kept in memory and in the OS credential store (Windows
 * Credential Manager, Keychain, Secret Service). They are never written to localStorage; only the
 * SteamID64 (public) and the reviews switch are persisted there. In the browser (dev) there is no
 * vault, so keys last for the session only.
 */
interface SecretsState {
  rawgKey: string;
  /** Not a secret: whether the public Steam review score is queried (it needs no key). */
  steamReviews: boolean;
  steamId: string;
  steamKey: string;
  hydrated: boolean;
  setRawgKey: (key: string) => Promise<void>;
  setSteamReviews: (on: boolean) => void;
  setSteam: (patch: { steamId?: string; steamKey?: string }) => Promise<void>;
  /** Loads keys from the vault and moves any legacy plaintext keys into it. Call once at boot. */
  hydrate: () => Promise<void>;
  clear: () => Promise<void>;
}

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

async function store(name: VaultName, value: string): Promise<void> {
  if (!vaultAvailable()) return;
  if (value) await vaultSet(name, value);
  else await vaultDelete(name);
}

export const useSecrets = create<SecretsState>()(
  persist(
    (set, get) => ({
      rawgKey: "",
      steamReviews: true,
      steamId: "",
      steamKey: "",
      hydrated: false,
      setRawgKey: async (key) => {
        const rawgKey = key.trim();
        set({ rawgKey });
        await store("rawgKey", rawgKey);
      },
      setSteamReviews: (steamReviews) => set({ steamReviews }),
      setSteam: async (patch) => {
        const steamKey = patch.steamKey === undefined ? get().steamKey : patch.steamKey.trim();
        set((s) => ({ steamId: patch.steamId === undefined ? s.steamId : patch.steamId.trim(), steamKey }));
        if (patch.steamKey !== undefined) await store("steamKey", steamKey);
      },
      hydrate: async () => {
        if (get().hydrated) return;
        if (!vaultAvailable()) {
          set({ hydrated: true });
          return;
        }
        try {
          // Legacy profiles kept the keys in localStorage: move them (the persisted copy is scrubbed by partialize).
          const { rawgKey: legacyRawg, steamKey: legacySteam } = get();
          if (legacyRawg) await vaultSet("rawgKey", legacyRawg);
          if (legacySteam) await vaultSet("steamKey", legacySteam);
          const [rawgKey, steamKey] = await Promise.all([vaultGet("rawgKey"), vaultGet("steamKey")]);
          set({ rawgKey: rawgKey ?? "", steamKey: steamKey ?? "", hydrated: true });
        } catch {
          // Vault unreachable: keep what is in memory, retry on the next boot.
          set({ hydrated: true });
        }
      },
      clear: async () => {
        set({ rawgKey: "", steamId: "", steamKey: "", steamReviews: true });
        if (vaultAvailable()) await Promise.allSettled([vaultDelete("rawgKey"), vaultDelete("steamKey")]);
      },
    }),
    {
      name: "games-gallery:secrets:v1",
      version: 1,
      // Keys are deliberately absent: persisting them is what this module exists to prevent.
      partialize: ({ steamReviews, steamId }) => ({ steamReviews, steamId }),
      merge: (persisted, current) => {
        const state = (typeof persisted === "object" && persisted !== null ? persisted : {}) as Record<string, unknown>;
        return {
          ...current,
          // Legacy plaintext keys are read once into memory; hydrate() moves them to the vault.
          rawgKey: clean(state["rawgKey"], 64),
          steamKey: clean(state["steamKey"], 40),
          steamReviews: state["steamReviews"] !== false,
          steamId: clean(state["steamId"], 20),
        };
      },
    },
  ),
);
