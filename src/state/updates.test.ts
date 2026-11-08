import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReleaseInfo } from "../domain/release";

const values = new Map<string, string>();
const storage = {
  getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => { values.set(k, v); },
  removeItem: (k: string) => { values.delete(k); },
};

const platform = vi.hoisted(() => ({
  fetchLatestRelease: vi.fn(),
  updaterReady: vi.fn(),
  downloadAndInstall: vi.fn(),
  relaunchApp: vi.fn(),
}));
vi.mock("../platform/updates", () => platform);

const release = (version: string): ReleaseInfo => ({
  version, tag: `v${version}`, url: `https://github.com/juninmd/games-gallery/releases/tag/v${version}`, notes: "", publishedAt: null,
});

async function load() {
  const { useUpdates, AUTO_INTERVAL_MS } = await import("./updates");
  const { useUi } = await import("./ui");
  return { useUpdates, useUi, AUTO_INTERVAL_MS };
}

beforeEach(() => {
  values.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", storage);
  for (const fn of Object.values(platform)) fn.mockReset();
  platform.updaterReady.mockResolvedValue(true);
  platform.downloadAndInstall.mockResolvedValue(undefined);
  platform.relaunchApp.mockResolvedValue(undefined);
});

describe("update check", () => {
  it("reports an available update, can install it, and tells the user", async () => {
    const { useUpdates, useUi } = await load();
    platform.fetchLatestRelease.mockResolvedValue(release("9.9.9"));
    await useUpdates.getState().check();
    const s = useUpdates.getState();
    expect(s.phase).toBe("available");
    expect(s.latest?.version).toBe("9.9.9");
    expect(s.canInstall).toBe(true);
    expect(useUi.getState().toasts.some((t) => t.msg.includes("v9.9.9"))).toBe(true);
    expect(values.get("games-gallery:update-checked")).toBeTruthy();
  });

  it("falls back to the release page when this build cannot verify updates", async () => {
    const { useUpdates } = await load();
    platform.updaterReady.mockResolvedValue(false);
    platform.fetchLatestRelease.mockResolvedValue(release("9.9.9"));
    await useUpdates.getState().check();
    expect(useUpdates.getState()).toMatchObject({ phase: "available", canInstall: false });
    await useUpdates.getState().install();
    expect(platform.downloadAndInstall).not.toHaveBeenCalled();
  });

  it("is current when the newest release is not newer than this build", async () => {
    const { useUpdates } = await load();
    platform.fetchLatestRelease.mockResolvedValue(release(__APP_VERSION__));
    await useUpdates.getState().check();
    expect(useUpdates.getState()).toMatchObject({ phase: "current", canInstall: false });
  });

  it("is current when the repository has no release yet", async () => {
    const { useUpdates } = await load();
    platform.fetchLatestRelease.mockResolvedValue(null);
    await useUpdates.getState().check();
    expect(useUpdates.getState()).toMatchObject({ phase: "current", latest: null });
  });

  it("surfaces a network failure and recovers on the next check", async () => {
    const { useUpdates } = await load();
    platform.fetchLatestRelease.mockRejectedValueOnce(new Error("Solicitação de rede falhou"));
    await useUpdates.getState().check();
    expect(useUpdates.getState()).toMatchObject({ phase: "error", error: "Solicitação de rede falhou" });
    platform.fetchLatestRelease.mockResolvedValue(release("9.9.9"));
    await useUpdates.getState().check();
    expect(useUpdates.getState()).toMatchObject({ phase: "available", error: null });
  });
});

describe("automatic checks", () => {
  it("skips when disabled or checked recently, and runs after the interval", async () => {
    const { useUpdates, AUTO_INTERVAL_MS } = await load();
    platform.fetchLatestRelease.mockResolvedValue(null);

    useUpdates.getState().setAuto(false);
    await useUpdates.getState().check({ auto: true });
    expect(platform.fetchLatestRelease).not.toHaveBeenCalled();

    useUpdates.getState().setAuto(true);
    await useUpdates.getState().check({ auto: true });
    expect(platform.fetchLatestRelease).toHaveBeenCalledTimes(1);

    await useUpdates.getState().check({ auto: true });
    expect(platform.fetchLatestRelease).toHaveBeenCalledTimes(1);

    await useUpdates.getState().check();
    expect(platform.fetchLatestRelease).toHaveBeenCalledTimes(2);

    useUpdates.setState({ checkedAt: Date.now() - AUTO_INTERVAL_MS - 1 });
    await useUpdates.getState().check({ auto: true });
    expect(platform.fetchLatestRelease).toHaveBeenCalledTimes(3);
  });

  it("remembers the preference across reloads and ignores a tampered value", async () => {
    const first = await load();
    first.useUpdates.getState().setAuto(false);
    vi.resetModules();
    expect((await load()).useUpdates.getState().auto).toBe(false);
    values.set("games-gallery:update-auto", "<script>");
    vi.resetModules();
    expect((await load()).useUpdates.getState().auto).toBe(true);
  });

  it("works in memory when storage throws", async () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    const { useUpdates } = await load();
    platform.fetchLatestRelease.mockResolvedValue(release("9.9.9"));
    await useUpdates.getState().check({ auto: true });
    expect(useUpdates.getState().phase).toBe("available");
  });
});

describe("install", () => {
  it("downloads, reports progress, then relaunches", async () => {
    const { useUpdates } = await load();
    platform.fetchLatestRelease.mockResolvedValue(release("9.9.9"));
    const seen: Array<number | null> = [];
    platform.downloadAndInstall.mockImplementation(async (onProgress: (f: number | null) => void) => {
      onProgress(0.5);
      seen.push(useUpdates.getState().progress);
      onProgress(1);
    });
    await useUpdates.getState().check();
    await useUpdates.getState().install();
    expect(seen).toEqual([0.5]);
    expect(platform.relaunchApp).toHaveBeenCalledTimes(1);
    expect(useUpdates.getState().phase).toBe("restarting");
  });

  it("keeps the update available and shows the error when the download fails", async () => {
    const { useUpdates } = await load();
    platform.fetchLatestRelease.mockResolvedValue(release("9.9.9"));
    platform.downloadAndInstall.mockRejectedValue(new Error("assinatura inválida"));
    await useUpdates.getState().check();
    await useUpdates.getState().install();
    expect(useUpdates.getState()).toMatchObject({ phase: "available", error: "assinatura inválida", progress: null });
    expect(platform.relaunchApp).not.toHaveBeenCalled();
  });

  it("does nothing when no update is available", async () => {
    const { useUpdates } = await load();
    await useUpdates.getState().install();
    expect(platform.downloadAndInstall).not.toHaveBeenCalled();
  });
});
