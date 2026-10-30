import { m } from "motion/react";
import { Clock, Sparkles } from "lucide-react";
import { useState } from "react";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import type { Game } from "../domain/types";
import { useUi } from "../state/ui";
import { Cover } from "./Cover";

/** The game to spotlight: what you are playing, else the most played one that has real art. */
export function pickFeatured(games: Game[]): Game | undefined {
  const withArt = games.filter((g) => g.coverUrl);
  const pool = withArt.length ? withArt : games;
  const playing = pool.filter((g) => g.status === "playing");
  const ranked = [...(playing.length ? playing : pool)].sort((a, b) => b.playtimeH - a.playtimeH || a.title.localeCompare(b.title));
  return ranked[0];
}

export function FeaturedHero({ game }: { game: Game }) {
  const select = useUi((s) => s.select);
  const [artFailed, setArtFailed] = useState(false);
  const playing = game.status === "playing";
  const platform = PLATFORM_BY_ID[game.platformId];

  return (
    <m.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Jogo em destaque"
      className="relative mb-8 grid min-h-[260px] items-center gap-8 overflow-hidden rounded-4xl border border-white/10 bg-ink-800 p-8 shadow-lift [grid-template-columns:minmax(0,1fr)_auto] max-[720px]:[grid-template-columns:minmax(0,1fr)]"
    >
      {game.coverUrl && !artFailed && (
        <img
          src={game.coverUrl}
          alt=""
          aria-hidden
          decoding="async"
          onError={() => setArtFailed(true)}
          className="absolute inset-0 size-full scale-125 animate-drift object-cover opacity-45 blur-3xl saturate-150"
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(100deg,rgb(7_8_13/0.92)_8%,rgb(7_8_13/0.55)_55%,rgb(7_8_13/0.15))]" />
      <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-rose/25 blur-3xl" />

      <div className="relative grid gap-4">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-mist backdrop-blur">
          <Sparkles size={13} className="text-ember" aria-hidden />
          {playing ? "Continue jogando" : "Em destaque"}
        </span>
        <h2 className="max-w-[18ch] font-display text-[clamp(30px,4.4vw,52px)] font-bold leading-[1] tracking-tight text-mist">{game.title}</h2>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fog">
          <span>{platform?.name}</span>
          <span aria-hidden>·</span>
          <span>{PROVIDER_BY_ID[game.providerId]?.name}</span>
          {game.year > 0 && <><span aria-hidden>·</span><span>{game.year}</span></>}
          {game.genres.length > 0 && <><span aria-hidden>·</span><span>{game.genres.slice(0, 3).join(" · ")}</span></>}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => select(game.id)}
            className="rounded-2xl bg-signature px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all duration-300 ease-expo hover:-translate-y-0.5 hover:brightness-110 active:scale-95"
          >
            Ver detalhes
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-mist backdrop-blur">
            <Clock size={13} aria-hidden /> {game.playtimeH.toLocaleString("pt-BR")} h jogadas
          </span>
        </div>
      </div>

      <div className="relative w-[150px] rotate-3 transition-transform duration-500 ease-expo hover:rotate-0 max-[720px]:hidden">
        <Cover game={game} />
      </div>
    </m.section>
  );
}
