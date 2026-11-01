import { describe, expect, it, vi } from "vitest";
import { httpGetJson } from "./http";
import { fetchOwnedGames, isValidSteamId, isValidSteamKey } from "./steamApi";

vi.mock("./http", () => ({ httpGetJson: vi.fn() }));
const mockGet = vi.mocked(httpGetJson);

const STEAM_ID = "76561197960287930";
const STEAM_KEY = "0123456789ABCDEF0123456789ABCDEF";

describe("Steam credential validation", () => {
  it("requires 17 digits for the SteamID64", () => {
    expect(isValidSteamId(STEAM_ID)).toBe(true);
    expect(isValidSteamId("7656119796028793")).toBe(false);
    expect(isValidSteamId("7656119796028793a")).toBe(false);
    expect(isValidSteamId("")).toBe(false);
  });

  it("requires 32 hex characters for the Web API key", () => {
    expect(isValidSteamKey(STEAM_KEY)).toBe(true);
    expect(isValidSteamKey(STEAM_KEY.toLowerCase())).toBe(true);
    expect(isValidSteamKey("0123")).toBe(false);
  });
});

describe("fetchOwnedGames", () => {
  it("converts minutes to hours and keeps the account playtime", async () => {
    mockGet.mockResolvedValueOnce({
      response: {
        game_count: 2,
        games: [
          { appid: 440, name: "Team Fortress 2", playtime_forever: 7230 },
          { appid: 620, name: "Portal 2", playtime_forever: 0 },
        ],
      },
    });
    const games = await fetchOwnedGames(STEAM_ID, STEAM_KEY);
    expect(games).toEqual([
      { storeId: "440", title: "Team Fortress 2", installed: false, playtimeH: 120.5 },
      { storeId: "620", title: "Portal 2", installed: false, playtimeH: 0 },
    ]);
    const url = mockGet.mock.calls.at(-1)![0] as string;
    expect(url.startsWith("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?")).toBe(true);
    expect(url).toContain(`steamid=${STEAM_ID}`);
    expect(url).toContain("include_appinfo=1");
  });

  it("skips entries without an appid or name", async () => {
    mockGet.mockResolvedValueOnce({ response: { games: [{ appid: 1 }, { name: "No id" }, { appid: 10, name: "Ok" }] } });
    expect(await fetchOwnedGames(STEAM_ID, STEAM_KEY)).toHaveLength(1);
  });

  it("returns an empty list for a private profile (no games key)", async () => {
    mockGet.mockResolvedValueOnce({ response: {} });
    expect(await fetchOwnedGames(STEAM_ID, STEAM_KEY)).toEqual([]);
  });

  it("refuses invalid credentials before any request", async () => {
    mockGet.mockClear();
    await expect(fetchOwnedGames("123", STEAM_KEY)).rejects.toThrow(/SteamID64/);
    await expect(fetchOwnedGames(STEAM_ID, "nope")).rejects.toThrow(/chave/i);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
