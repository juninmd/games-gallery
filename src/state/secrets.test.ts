import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();
const storage = {
  getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => { values.set(k, v); },
  removeItem: (k: string) => { values.delete(k); },
};
const vault = vi.hoisted(() => ({ store: new Map<string, string>(), available: true }));
vi.mock("../platform/vault", () => ({
  vaultAvailable: () => vault.available,
  vaultGet: async (n: string) => vault.store.get(n) ?? null,
  vaultSet: async (n: string, v: string) => { vault.store.set(n, v); },
  vaultDelete: async (n: string) => { vault.store.delete(n); },
}));

const KEY = "games-gallery:secrets:v1";
const STEAM_KEY = "A".repeat(32);

beforeEach(() => {
  values.clear();
  vault.store.clear();
  vault.available = true;
  vi.resetModules();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
});

describe("secrets: keys live in the OS vault, never in localStorage", () => {
  it("never writes API keys to localStorage", async () => {
    const { useSecrets } = await import("./secrets");
    await useSecrets.getState().setRawgKey("rawg-secret");
    await useSecrets.getState().setSteam({ steamId: "76561198000000000", steamKey: STEAM_KEY });
    const stored = values.get(KEY) ?? "";
    expect(stored).not.toContain("rawg-secret");
    expect(stored).not.toContain(STEAM_KEY);
    expect(stored).toContain("76561198000000000");
    expect(vault.store.get("rawgKey")).toBe("rawg-secret");
    expect(vault.store.get("steamKey")).toBe(STEAM_KEY);
  });

  it("migrates legacy plaintext keys into the vault and scrubs localStorage", async () => {
    values.set(KEY, JSON.stringify({ state: { rawgKey: "old-rawg", steamKey: STEAM_KEY, steamId: "76561198000000000", steamReviews: true }, version: 1 }));
    const { useSecrets } = await import("./secrets");
    await useSecrets.persist.rehydrate();
    await useSecrets.getState().hydrate();
    expect(vault.store.get("rawgKey")).toBe("old-rawg");
    expect(vault.store.get("steamKey")).toBe(STEAM_KEY);
    expect(useSecrets.getState().steamKey).toBe(STEAM_KEY);
    expect(values.get(KEY)).not.toContain("old-rawg");
    expect(values.get(KEY)).not.toContain(STEAM_KEY);
  });

  it("keeps legacy keys in memory (and out of storage) when there is no vault", async () => {
    vault.available = false;
    values.set(KEY, JSON.stringify({ state: { rawgKey: "old-rawg" }, version: 1 }));
    const { useSecrets } = await import("./secrets");
    await useSecrets.persist.rehydrate();
    await useSecrets.getState().hydrate();
    expect(useSecrets.getState().rawgKey).toBe("old-rawg");
    useSecrets.getState().setSteamReviews(false);
    expect(values.get(KEY) ?? "").not.toContain("old-rawg");
  });

  it("loads keys from the vault on boot and clearing removes them everywhere", async () => {
    vault.store.set("steamKey", STEAM_KEY);
    const { useSecrets } = await import("./secrets");
    await useSecrets.getState().hydrate();
    expect(useSecrets.getState().steamKey).toBe(STEAM_KEY);
    await useSecrets.getState().clear();
    expect(vault.store.size).toBe(0);
    expect(useSecrets.getState().steamKey).toBe("");
  });

  it("an empty value removes the vault entry instead of storing an empty secret", async () => {
    const { useSecrets } = await import("./secrets");
    await useSecrets.getState().setRawgKey("x");
    await useSecrets.getState().setRawgKey("   ");
    expect(vault.store.has("rawgKey")).toBe(false);
  });
});
