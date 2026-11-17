import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { game } from "../domain/gameFactory";

let covers: typeof import("./covers");
let useLibrary: typeof import("./library").useLibrary;
let useSecrets: typeof import("./secrets").useSecrets;

beforeAll(async () => {
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  covers = await import("./covers");
  ({ useLibrary } = await import("./library"));
  ({ useSecrets } = await import("./secrets"));
});

afterAll(() => vi.unstubAllGlobals());

describe("filling missing covers", () => {
  it("only touches games without a cover, keeps going past failures, and reports what it found", async () => {
    const lib = useLibrary.getState();
    const a = { ...game("pc", "gog", "Alpha", 2020, "RPG"), coverUrl: undefined };
    const b = { ...game("pc", "gog", "Beta", 2020, "RPG"), coverUrl: undefined };
    const c = { ...game("pc", "gog", "Gamma", 2020, "RPG"), coverUrl: "https://cdn.cloudflare.steamstatic.com/x.jpg" };
    [a, b, c].forEach((g) => lib.addGame(g));
    useSecrets.setState({ sgdbKey: "0123456789abcdef0123456789abcdef" });
    const get = vi.fn(async (url: string) => {
      if (url.includes("Beta")) throw new Error("HTTP 500");
      if (url.includes("/search/")) return { success: true, data: [{ id: 9 }] };
      return { success: true, data: [{ url: "https://cdn2.steamgriddb.com/grid/alpha.png" }] };
    });
    expect(await covers.fetchMissingCovers(get)).toEqual({ found: 1, tried: 2 });
    const byId = (id: string) => useLibrary.getState().games.find((g) => g.id === id);
    expect(byId(a.id)?.coverUrl).toBe("https://cdn2.steamgriddb.com/grid/alpha.png");
    expect(byId(b.id)?.coverUrl).toBeUndefined();
    expect(byId(c.id)?.coverUrl).toBe("https://cdn.cloudflare.steamstatic.com/x.jpg");
  });
});
