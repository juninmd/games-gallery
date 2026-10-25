import { afterEach, describe, expect, it, vi } from "vitest";
import { httpGetJson, httpGetText, readCapped, resolveRequestUrl } from "./http";

describe("resolveRequestUrl", () => {
  it("routes allowed hosts through the dev proxy in the browser", () => {
    expect(resolveRequestUrl("https://store.steampowered.com/appreviews/620?json=1", false)).toBe("/proxy/steam/appreviews/620?json=1");
  });

  it("keeps the real URL under Tauri (the HTTP plugin scope is the allow-list)", () => {
    const u = "https://api.rawg.io/api/games?search=hades";
    expect(resolveRequestUrl(u, true)).toBe(u);
  });

  it("also routes the Epic free-games backend and the PlayStation Blog", () => {
    expect(resolveRequestUrl("https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR", false)).toBe("/proxy/epic/freeGamesPromotions?locale=pt-BR");
    expect(resolveRequestUrl("https://blog.playstation.com/feed/?paged=2", false)).toBe("/proxy/psblog/feed/?paged=2");
  });

  it("rejects unknown hosts, plain http and lookalike hosts", () => {
    for (const bad of ["https://evil.example/x", "http://store.steampowered.com/x", "https://store.steampowered.com.evil.io/x", "https://api.rawg.io@evil.io/x"]) {
      expect(() => resolveRequestUrl(bad, false), bad).toThrow();
    }
  });
});

describe("readCapped", () => {
  it("stops reading and cancels the stream once the cap is reached", async () => {
    let pulled = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(c) { pulled++; c.enqueue(new TextEncoder().encode("x".repeat(100))); },
      cancel() { cancelled = true; },
    });
    const text = await readCapped(new Response(body), 250);
    expect(text).toHaveLength(250);
    expect(pulled).toBeLessThan(10);
    expect(cancelled).toBe(true);
  });
  it("returns short bodies whole", async () => {
    expect(await readCapped(new Response("hello"), 100)).toBe("hello");
  });
  it("decodes multibyte text across chunks and preserves character cap", async () => {
    const bytes = new TextEncoder().encode("café🎮x");
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes.slice(0, 4)); c.enqueue(bytes.slice(4)); c.close(); } });
    expect(await readCapped(new Response(body), 6)).toBe("café🎮");
  });
});

describe("bounded HTTP requests", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("times out a fetch that never resolves", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const request = httpGetJson("https://api.rawg.io/api/games");
    const assertion = expect(request).rejects.toThrow("Tempo limite");
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("disposes a response that arrives after its request timed out", async () => {
    vi.useFakeTimers();
    let deliver!: (response: Response) => void;
    let cancelled = false;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { deliver = resolve; })));
    const request = httpGetJson("https://api.rawg.io/api/games");
    const assertion = expect(request).rejects.toThrow("Tempo limite");
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode("{}")); }, cancel() { cancelled = true; } });
    deliver(new Response(body));
    await Promise.resolve();
    await Promise.resolve();
    expect(cancelled).toBe(true);
  });

  it("times out a stalled body even when the stream ignores abort", async () => {
    vi.useFakeTimers();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({ pull() { return new Promise(() => undefined); }, cancel() { cancelled = true; } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
    const request = httpGetJson("https://api.rawg.io/api/games");
    const assertion = expect(request).rejects.toThrow("Tempo limite");
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
    expect(cancelled).toBe(true);
  });

  it("times out and cancels stalled RSS reads", async () => {
    vi.useFakeTimers();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({ pull() { return new Promise(() => undefined); }, cancel() { cancelled = true; } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
    const request = httpGetText("https://blog.playstation.com/feed/");
    const assertion = expect(request).rejects.toThrow("Tempo limite");
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
    expect(cancelled).toBe(true);
  });

  it("rejects JSON responses over the byte limit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ value: "x".repeat(4 * 1024 * 1024) }))));
    await expect(httpGetJson("https://api.rawg.io/api/games")).rejects.toThrow("limite");
  });

  it("clears the deadline after a successful response", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    await expect(httpGetJson("https://api.rawg.io/api/games")).resolves.toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes abort listeners after each successful streamed chunk", async () => {
    let activeListeners = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const signal = init.signal!;
      const add = signal.addEventListener.bind(signal);
      const remove = signal.removeEventListener.bind(signal);
      signal.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        if (type === "abort") activeListeners++;
        add(type, listener, options);
      }) as typeof signal.addEventListener;
      signal.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
        if (type === "abort") activeListeners--;
        remove(type, listener, options);
      }) as typeof signal.removeEventListener;
      return new Response(new ReadableStream<Uint8Array>({
        start(c) { for (let i = 0; i < 1000; i++) c.enqueue(new TextEncoder().encode(" ")); c.enqueue(new TextEncoder().encode("{}")); c.close(); },
      }));
    }));
    await expect(httpGetJson("https://api.rawg.io/api/games")).resolves.toEqual({});
    expect(activeListeners).toBe(0);
  });
});
