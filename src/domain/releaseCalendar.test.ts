import { describe, expect, it } from "vitest";
import type { StoreRelease, WishlistEntry } from "./deals";
import { releaseCalendar } from "./releaseCalendar";

const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000;
const entry = (title: string, release?: StoreRelease): WishlistEntry => ({ appId: title.length, title, url: "", release });

describe("releaseCalendar", () => {
  it("groups unreleased games by month at Steam's precision, soonest first, undated last", () => {
    const groups = releaseCalendar([
      entry("Released", { date: utc(2025, 1, 1), comingSoon: false }),
      entry("TBA", { comingSoon: true, display: "text_tba", message: "Em 2027?" }),
      entry("Year", { date: utc(2026, 1, 1), comingSoon: true, display: "date_year" }),
      entry("Q4", { date: utc(2026, 10, 1), comingSoon: true, display: "date_quarter" }),
      entry("Late Nov", { date: utc(2026, 11, 28), comingSoon: true, display: "date_full" }),
      entry("Nov", { date: utc(2026, 11, 1), comingSoon: true, display: "date_month" }),
      entry("Early Nov", { date: utc(2026, 11, 20), comingSoon: true, display: "date_full" }),
      entry("Dec", { date: utc(2026, 12, 3), comingSoon: true, display: "date_full" }),
      entry("No release info"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["2026-11", "2026-12", "2026-Q4", "2026", "tba"]);
    expect(groups[0]?.items.map((i) => [i.entry.title, i.when])).toEqual([["Nov", "nov 2026"], ["Early Nov", "20 nov"], ["Late Nov", "28 nov"]]);
    expect(groups[2]).toMatchObject({ label: "4º tri 2026" });
    expect(groups[4]?.items[0]?.when).toBe("Em 2027?");
  });

  it("is empty when nothing on the wishlist is unreleased", () => {
    expect(releaseCalendar([entry("A", { date: utc(2020, 1, 1), comingSoon: false }), entry("B")])).toEqual([]);
  });
});
