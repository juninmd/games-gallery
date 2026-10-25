import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Game } from "../domain/types";
import type { RatingsEntry } from "../domain/ratings";

const fetchPublicRatings = vi.hoisted(() => vi.fn());
vi.mock("../platform/ratingsApi", () => ({ fetchPublicRatings }));

import { useRatings, useSecrets } from "./ratings";

const game = { id: "test-game", title: "Example" } as Game;
const cached: RatingsEntry = { fetchedAt: Date.now() - 1000, scores: [{ source: "steam", label: "Steam", score: 80 }], errors: [] };
const fresh: RatingsEntry = { fetchedAt: Date.now(), scores: [{ source: "steam", label: "Steam", score: 90 }], errors: [] };

describe("ratings refresh failures", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchPublicRatings.mockReset();
    useSecrets.setState({ rawgKey: "" });
    useRatings.setState({ entries: { [game.id]: cached }, loading: {}, errors: {} });
  });

  it("keeps cached ratings, clears loading, reports an error, and supports retry", async () => {
    fetchPublicRatings.mockRejectedValueOnce(new Error("network details"));
    await useRatings.getState().refresh(game, true);

    expect(useRatings.getState().entries[game.id]).toBe(cached);
    expect(useRatings.getState().loading[game.id]).toBe(false);
    expect(useRatings.getState().errors[game.id]).toMatch(/Tente novamente/);
    expect(useRatings.getState().errors[game.id]).not.toContain("network details");

    fetchPublicRatings.mockResolvedValueOnce(fresh);
    await useRatings.getState().refresh(game, true);
    expect(useRatings.getState().entries[game.id]).toBe(fresh);
    expect(useRatings.getState().loading[game.id]).toBe(false);
    expect(useRatings.getState().errors[game.id]).toBeUndefined();
  });
});
