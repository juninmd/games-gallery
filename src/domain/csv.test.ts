import { describe, expect, it } from "vitest";
import { csvToGames, gamesToCsv, parseCsv } from "./csv";
import type { Game } from "./types";

const game = (over: Partial<Game> = {}): Game => ({
  id: "g1", title: "Hades", platformId: "pc", providerId: "steam", year: 2020, genres: ["Roguelike"], status: "completed", owned: true,
  installed: true, playtimeH: 42.46, rating: 5, ...over,
});
let n = 0;
const newId = () => `new-${++n}`;
const ok = (r: ReturnType<typeof csvToGames>) => {
  if ("error" in r) throw new Error(r.error);
  return r;
};

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, embedded newlines, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\r\n"line1\nline2",z\r\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["line1\nline2", "z"]]);
  });
  it("detects the semicolon separator Excel uses in pt-BR and skips blank lines", () => {
    expect(parseCsv("Nome;Horas\n\nHades;12,5\n")).toEqual([["Nome", "Horas"], ["Hades", "12,5"]]);
  });
  it("keeps a trailing row without a final newline and never throws on a dangling quote", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(() => parseCsv('a,b\n"open')).not.toThrow();
  });
});

describe("gamesToCsv", () => {
  it("neutralises spreadsheet formulas in text cells", () => {
    const csv = gamesToCsv([game({ title: "=HYPERLINK(\"http://evil\")", notes: "+cmd|' /C calc'!A0" })]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csv).toContain("'+cmd");
    expect(csv.split("\r\n")[1]).not.toMatch(/^=/);
  });
  it("starts with a BOM and writes numbers untouched", () => {
    const csv = gamesToCsv([game({ rating: undefined })]);
    expect(csv.startsWith("﻿Title,")).toBe(true);
    expect(csv).toContain(",Zerado,42.5,");
  });
});

describe("csvToGames", () => {
  it("round-trips an export, including tags, hours to beat and formula-looking titles", () => {
    const src = [game({ tags: ["Cozy", "Co-op"], hoursToBeat: 22, notes: "ótimo, \"mesmo\"" }), game({ id: "g2", title: "-Dash", providerId: "gog", status: "backlog" })];
    const back = ok(csvToGames(gamesToCsv(src), [], newId));
    expect(back.games.map((g) => g.title)).toEqual(["Hades", "-Dash"]);
    expect(back.games[0]).toMatchObject({ providerId: "steam", platformId: "pc", status: "completed", rating: 5, hoursToBeat: 22, tags: ["Cozy", "Co-op"], notes: "ótimo, \"mesmo\"", playtimeH: 42.5 });
    expect(back.games[1]).toMatchObject({ providerId: "gog", status: "backlog" });
  });
  it("reads a Playnite-style export with its own column names and statuses", () => {
    const csv = "Name,Source,Platform,CompletionStatus,Playtime,UserScore,Categories\nCeleste,Steam,PC (Windows),Beaten,12,5,Indie; Hard\n";
    const r = ok(csvToGames(csv, [], newId));
    expect(r.games[0]).toMatchObject({ title: "Celeste", providerId: "steam", status: "completed", playtimeH: 12, rating: 5, tags: ["Indie", "Hard"] });
  });
  it("falls back to PC and Coleção física for unknown platform or store, and maps wishlist to not owned", () => {
    const r = ok(csvToGames("Title,Store,Platform,Status\nFoo,Loja Estranha,Nave Espacial,Wishlist\n", [], newId));
    expect(r.games[0]).toMatchObject({ providerId: "physical", platformId: "pc", status: "wishlist", owned: false });
  });
  it("skips empty titles, counts library duplicates and clamps out-of-range numbers", () => {
    const existing = [game()];
    const r = ok(csvToGames("Title,Store,Rating,Hours\nHades,Steam,3,1\n,Steam,1,1\n™,Steam,1,1\nBig,Steam,99,-5\n", existing, newId));
    expect(r).toMatchObject({ skipped: 2, duplicates: 1 });
    expect(r.games).toHaveLength(1);
    expect(r.games[0]).toMatchObject({ title: "Big", rating: undefined, playtimeH: 0 });
  });
  it("does not add the same title twice from one file", () => {
    const r = ok(csvToGames("Title,Store\nHades,Steam\nHADES,Steam\n", [], newId));
    expect(r.games).toHaveLength(1);
    expect(r.duplicates).toBe(1);
  });
  it("explains a file without a title column and refuses an oversized one", () => {
    expect(csvToGames("A,B\n1,2\n", [])).toHaveProperty("error");
    expect(csvToGames("", [])).toHaveProperty("error");
    expect(csvToGames("x".repeat(9 * 1024 * 1024), [])).toHaveProperty("error");
  });
});
