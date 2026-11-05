import { beforeEach, describe, expect, it, vi } from "vitest";

const { notifyNative } = vi.hoisted(() => {
  const mem = new Map<string, string>();
  const localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  Object.assign(globalThis, { localStorage, window: { localStorage } });
  return { notifyNative: vi.fn().mockResolvedValue(true) };
});
vi.mock("../platform/notify", () => ({ notifyNative, ensurePermission: vi.fn().mockResolvedValue(true) }));

import type { Deal } from "../domain/deals";
import type { Freebie } from "../domain/freebies";
import { runChecks } from "./alertWatcher";
import { useDeals } from "./deals";
import { useFreebies } from "./freebies";
import { usePrefs } from "./prefs";
import { usePriceAlerts } from "./priceAlerts";
import { useUi } from "./ui";

const deal = (finalCents: number): Deal => ({ id: "steam:1", store: "steam", title: "Hades", url: "https://store.steampowered.com/app/1", currency: "BRL", originalCents: 8000, finalCents, discountPercent: 50 });
const free = (id: string): Freebie => ({ id: `epic:${id}`, store: "epic", title: id, url: "https://store.epicgames.com/", status: "now" });
const refreshDeals = vi.fn().mockResolvedValue(undefined);
const refreshEpic = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  usePrefs.setState({ notifications: false, announcedHits: [], seenFreebies: undefined });
  usePriceAlerts.setState({ targets: {}, hits: [] });
  useUi.setState({ toasts: [] });
  useDeals.setState({ deals: { steam: { fetchedAt: Date.now(), items: [deal(3000)] }, gog: undefined, epic: undefined }, wishlist: undefined, refreshDeals, refreshWishlist: vi.fn() });
  useFreebies.setState({ epic: { fetchedAt: Date.now(), items: [free("a")] }, refreshEpic });
});

describe("price targets", () => {
  it("does nothing without a target", async () => {
    await runChecks();
    expect(useUi.getState().toasts).toHaveLength(0);
    expect(refreshDeals).not.toHaveBeenCalled();
  });

  it("tells the user once per price: toast always, native only when opted in", async () => {
    usePriceAlerts.getState().setTarget("Hades", 3500, "BRL");
    await runChecks();
    expect(useUi.getState().toasts.map((t) => t.msg).join()).toContain("Preço-alvo atingido");
    expect(notifyNative).not.toHaveBeenCalled();

    await runChecks();
    expect(useUi.getState().toasts).toHaveLength(1);

    usePrefs.setState({ notifications: true, announcedHits: [] });
    await runChecks();
    expect(notifyNative).toHaveBeenCalledTimes(1);
    expect(notifyNative).toHaveBeenCalledWith("Preço-alvo atingido", expect.stringContaining("Hades"));
  });

  it("announces again when the price falls further", async () => {
    usePriceAlerts.getState().setTarget("Hades", 3500, "BRL");
    await runChecks();
    useDeals.setState({ deals: { steam: { fetchedAt: Date.now(), items: [deal(2000)] }, gog: undefined, epic: undefined } });
    await runChecks();
    expect(useUi.getState().toasts).toHaveLength(2);
  });
});

describe("Epic giveaways", () => {
  it("is not even requested while notifications are off", async () => {
    await runChecks();
    expect(refreshEpic).not.toHaveBeenCalled();
  });

  it("records what is free on the first run silently, then announces only newcomers", async () => {
    usePrefs.setState({ notifications: true });
    await runChecks();
    expect(notifyNative).not.toHaveBeenCalled();
    expect(usePrefs.getState().seenFreebies).toEqual(["epic:a"]);

    useFreebies.setState({ epic: { fetchedAt: Date.now(), items: [free("a"), free("b")] } });
    await runChecks();
    expect(notifyNative).toHaveBeenCalledWith("Jogo grátis na Epic", "b");
    await runChecks();
    expect(notifyNative).toHaveBeenCalledTimes(1);
  });
});
