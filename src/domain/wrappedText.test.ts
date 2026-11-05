import { describe, expect, it } from "vitest";
import type { Wrapped } from "./playLog";
import { wrappedPlain, wrappedText } from "./wrappedText";

const base: Wrapped = {
  year: 2026,
  logged: { hours: 6.3, activeDays: 3, longestStreak: 2, busiestMonth: 0, top: [{ title: "Hades", hours: 5 }, { title: "Celeste", hours: 1.3 }] },
  library: { owned: 2, completed: 1, hours: 35, topGenres: [{ genre: "Ação", hours: 25 }], topStores: [{ providerId: "steam", hours: 30 }] },
};

describe("wrappedText", () => {
  it("words each fact in pt-BR with correct plurals", () => {
    const t = wrappedText(base);
    expect(t.headline).toBe("6,3 h jogadas em 2026");
    expect(t.highlights).toEqual(["3 dias com jogo registrado", "Maior sequência: 2 dias", "Mês mais ativo: janeiro"]);
    expect(t.top).toEqual(["1. Hades — 5 h", "2. Celeste — 1,3 h"]);
    expect(t.library).toEqual(["2 jogos na coleção, 1 zerado", "35 h somando todas as lojas", "Gênero favorito: Ação", "Loja onde mais joga: Steam"]);
  });
  it("uses singulars", () => {
    const t = wrappedText({ ...base, logged: { ...base.logged, activeDays: 1, longestStreak: 1 }, library: { ...base.library, owned: 1, completed: 2 } });
    expect(t.highlights[0]).toBe("1 dia com jogo registrado");
    expect(t.library[0]).toBe("1 jogo na coleção, 2 zerados");
  });
  it("explains an empty year instead of showing zeros", () => {
    const t = wrappedText({ ...base, logged: { hours: 0, activeDays: 0, longestStreak: 0, top: [] }, library: { ...base.library, topGenres: [], topStores: [] } });
    expect(t.headline).toBe("Ainda sem horas registradas em 2026");
    expect(t.highlights).toHaveLength(1);
    expect(t.top).toEqual([]);
    expect(t.library).toHaveLength(2);
  });
  it("falls back to the raw id for an unknown store and renders plain text", () => {
    const t = wrappedText({ ...base, library: { ...base.library, topStores: [{ providerId: "ghost", hours: 1 }] } });
    expect(t.library.at(-1)).toBe("Loja onde mais joga: ghost");
    expect(wrappedPlain(wrappedText(base))).toContain("Mais jogados:\n1. Hades — 5 h");
  });
});
