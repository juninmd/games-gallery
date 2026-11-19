import { describe, expect, it, vi } from "vitest";
import type { Game } from "../domain/types";
import { FAMILY_TAG, fetchFamilySharedGames, isValidSteamToken, tagFamilyGames } from "./steamFamily";

const ME = "76561197960287930";
const OTHER = "76561197960287931";
const TOKEN = "eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiI3NjU2MSJ9.c2ln-_";

describe("isValidSteamToken", () => {
  it("accepts a JWT and refuses anything else, including oversized values", () => {
    expect(isValidSteamToken(TOKEN)).toBe(true);
    expect(isValidSteamToken(` ${TOKEN} `)).toBe(true);
    expect(isValidSteamToken("0123456789ABCDEF0123456789ABCDEF")).toBe(false);
    expect(isValidSteamToken("a.b.c&x=1")).toBe(false);
    expect(isValidSteamToken(`${"a".repeat(1024)}.b.c`)).toBe(false);
    expect(isValidSteamToken("")).toBe(false);
  });
});

describe("fetchFamilySharedGames", () => {
  it("lists only shareable apps owned by other members", async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ response: { family_groupid: "123456" } })
      .mockResolvedValueOnce({
        response: {
          apps: [
            { appid: 730, name: "Counter-Strike 2", owner_steamids: [OTHER] },
            { appid: 440, name: "Mine", owner_steamids: [ME] },
            { appid: 570, name: "Excluded", owner_steamids: [OTHER], exclude_reason: 2 },
            { appid: 0, name: "Bad" },
          ],
        },
      });
    expect(await fetchFamilySharedGames(ME, TOKEN, get)).toEqual([{ storeId: "730", title: "Counter-Strike 2", installed: false }]);
    const [groupUrl, appsUrl] = get.mock.calls.map((c) => String(c[0]));
    expect(groupUrl).toContain("IFamilyGroupsService/GetFamilyGroupForUser/v1/?");
    expect(appsUrl).toContain("GetSharedLibraryApps/v1/?");
    expect(appsUrl).toContain("family_groupid=123456");
    expect(appsUrl).toContain(`steamid=${ME}`);
  });

  it("returns nothing when the user is in no family", async () => {
    const get = vi.fn().mockResolvedValueOnce({ response: {} });
    expect(await fetchFamilySharedGames(ME, TOKEN, get)).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("explains an expired token instead of a bare HTTP status", async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error("HTTP 401"));
    await expect(fetchFamilySharedGames(ME, TOKEN, get)).rejects.toThrow(/expirado/);
  });

  it("refuses invalid input before any request", async () => {
    const get = vi.fn();
    await expect(fetchFamilySharedGames("1", TOKEN, get)).rejects.toThrow(/SteamID64/);
    await expect(fetchFamilySharedGames(ME, "not-a-jwt", get)).rejects.toThrow(/Token/);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("tagFamilyGames", () => {
  const game = (id: string, providerId: string, storeId: string, tags?: string[]) => ({ id, providerId, storeId, tags }) as Game;

  it("tags only the matching Steam games, once", () => {
    const out = tagFamilyGames(
      [game("a", "steam", "730"), game("b", "epic", "730"), game("c", "steam", "440"), game("d", "steam", "730", [FAMILY_TAG])],
      [{ storeId: "730", title: "CS2", installed: false }],
    );
    expect(out.map((g) => g.tags)).toEqual([[FAMILY_TAG], undefined, undefined, [FAMILY_TAG]]);
  });
});
