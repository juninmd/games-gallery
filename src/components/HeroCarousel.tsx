import { AnimatePresence, m } from "motion/react";
import { Dices, Info, Play, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { pickBacklog, totalHours, type GameGroup } from "../domain/duplicates";
import { PLATFORM_BY_ID } from "../domain/platforms";
import type { Game } from "../domain/types";
import { useUi } from "../state/ui";
import { Cover } from "./Cover";
import { ambientFor, openGame, prefersReducedMotion } from "./shell/ambient";
import { storeSummary } from "./StoreChips";
import { useLaunch } from "./useLaunch";

const ROTATE_MS = 8000;
const EASE = [0.16, 1, 0.3, 1] as const;

function PlayButton({ game }: { game: Game }) {
  const { plan, play } = useLaunch(game);
  return (
    <button type="button" className="hero-btn hero-btn-go" onClick={() => void play()} disabled={plan.kind === "blocked"} title={plan.kind === "blocked" ? plan.reason : undefined}>
      <Play size={16} className="fill-current" aria-hidden /> Jogar
    </button>
  );
}

/**
 * The library's stage: what you are playing, one game at a time, rotating on its own
 * (paused on hover, focus and reduced motion). Falls back to the most played game.
 */
export function HeroCarousel({ slides, groups }: { slides: GameGroup[]; groups: GameGroup[] }) {
  const setAmbient = useUi((s) => s.setAmbient);
  const select = useUi((s) => s.select);
  const go = useUi((s) => s.go);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = slides[index % slides.length]!;
  const { primary, members } = current;
  // The primary may lack art that another store has.
  const game = useMemo(() => primary.coverUrl ? primary : { ...primary, coverUrl: members.find((x) => x.coverUrl)?.coverUrl }, [primary, members]);
  const platform = PLATFORM_BY_ID[game.platformId];
  const hours = totalHours(members);
  const playing = game.status === "playing";
  const owned = members.find((x) => x.installed && x.owned);

  useEffect(() => { setAmbient(ambientFor(game)); }, [game, setAmbient]);

  useEffect(() => {
    if (slides.length < 2 || paused || prefersReducedMotion()) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearTimeout(t);
  }, [index, paused, slides.length]);

  const pickRandom = () => {
    const pick = pickBacklog(groups);
    if (pick) select(pick.primary.id); else go("board");
  };

  return (
    <section
      className="hero"
      aria-roledescription="carrossel"
      aria-label={playing ? "Continue jogando" : "Em destaque"}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AnimatePresence initial={false}>
        <m.div
          key={game.id}
          className="hero-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: EASE }}
          aria-hidden
        >
          {game.coverUrl
            ? <img src={game.coverUrl} alt="" decoding="async" />
            : <span style={{ background: `radial-gradient(90% 120% at 80% 20%, ${platform?.color ?? "#ff4d8d"}, transparent 70%)` }} />}
        </m.div>
      </AnimatePresence>
      <div className="hero-shade" aria-hidden />

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={game.id}
          className="hero-copy"
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="hero-eyebrow">
            <Sparkles size={13} aria-hidden /> {playing ? "Continue jogando" : "Em destaque"}
            {slides.length > 1 && <span className="tabular-nums"> · {index % slides.length + 1}/{slides.length}</span>}
          </span>
          <h2 className="hero-title">
            {game.title.split(" ").map((word, i) => (
              <span key={`${word}-${i}`} style={{ animationDelay: `${i * 70}ms` }}>{word} </span>
            ))}
          </h2>
          <p className="hero-meta">
            <b>{platform?.name}</b>
            <span>{storeSummary(members, 4).names.join(" · ")}</span>
            {game.year > 0 && <span>{game.year}</span>}
            {game.genres.length > 0 && <span>{game.genres.slice(0, 3).join(" · ")}</span>}
          </p>
          <div className="hero-progress">
            <span className="hero-progress-track"><i style={{ width: `${Math.min(100, Math.max(4, (hours / 200) * 100))}%` }} /></span>
            <span className="tabular-nums">{hours.toLocaleString("pt-BR")} h jogadas</span>
          </div>
          <div className="hero-actions">
            {owned && <PlayButton game={owned} />}
            <button type="button" className="hero-btn" onClick={() => openGame(game.id, document.querySelector<HTMLElement>(".hero-cover .cover"))}>
              <Info size={16} aria-hidden /> Ver detalhes
            </button>
            <button type="button" className="hero-btn" onClick={pickRandom}>
              <Dices size={16} aria-hidden /> Sortear do backlog
            </button>
          </div>
        </m.div>
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <m.button
          key={game.id}
          type="button"
          className="hero-cover"
          onClick={(e) => openGame(game.id, e.currentTarget.querySelector<HTMLElement>(".cover"))}
          aria-label={`Abrir ${game.title}`}
          initial={{ opacity: 0, rotateY: -40, x: 40 }}
          animate={{ opacity: 1, rotateY: -14, x: 0 }}
          exit={{ opacity: 0, rotateY: 20, x: -30 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <Cover game={game} />
        </m.button>
      </AnimatePresence>

      {slides.length > 1 && (
        <div className="hero-dots" role="group" aria-label="Escolher destaque">
          {slides.map((s, i) => (
            <button
              key={s.primary.id}
              type="button"
              aria-label={s.primary.title}
              aria-current={i === index % slides.length ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={paused ? "is-paused" : ""}
              style={{ "--ms": `${ROTATE_MS}ms` } as React.CSSProperties}
            >
              <i />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
