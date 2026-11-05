import type { Wrapped } from "./playLog";
import { PROVIDER_BY_ID } from "./providers";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const n = (v: number) => v.toLocaleString("pt-BR");
const plural = (v: number, one: string, many: string) => `${n(v)} ${v === 1 ? one : many}`;

export interface WrappedText {
  headline: string;
  /** What happened this year (empty when nothing was logged). */
  highlights: string[];
  top: string[];
  /** Whole-library facts that do not depend on the log. */
  library: string[];
}

/** One wording for the on-screen summary, the clipboard text and the image, so they never disagree. */
export function wrappedText(w: Wrapped): WrappedText {
  const l = w.logged;
  const logged = l.hours > 0;
  const lib = w.library;
  const store = lib.topStores[0];
  return {
    headline: logged ? `${n(l.hours)} h jogadas em ${w.year}` : `Ainda sem horas registradas em ${w.year}`,
    highlights: logged
      ? [
          `${plural(l.activeDays, "dia", "dias")} com jogo registrado`,
          `Maior sequência: ${plural(l.longestStreak, "dia", "dias")}`,
          ...(l.busiestMonth !== undefined ? [`Mês mais ativo: ${MONTHS[l.busiestMonth]}`] : []),
        ]
      : ["O app registra o aumento de horas a cada sincronização; jogue e sincronize para ver este resumo crescer."],
    top: l.top.map((t, i) => `${i + 1}. ${t.title} — ${n(t.hours)} h`),
    library: [
      `${plural(lib.owned, "jogo", "jogos")} na coleção, ${n(lib.completed)} zerado${lib.completed === 1 ? "" : "s"}`,
      `${n(lib.hours)} h somando todas as lojas`,
      ...(lib.topGenres[0] ? [`Gênero favorito: ${lib.topGenres[0].genre}`] : []),
      ...(store ? [`Loja onde mais joga: ${PROVIDER_BY_ID[store.providerId]?.name ?? store.providerId}`] : []),
    ],
  };
}

export const wrappedPlain = (t: WrappedText): string =>
  [t.headline, ...t.highlights, ...(t.top.length ? ["", "Mais jogados:", ...t.top] : []), "", ...t.library].join("\n");
