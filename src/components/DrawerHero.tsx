import { Clock, HardDrive, Star, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import { averageScore, scoreTone, userScore100 } from "../domain/ratings";
import { STATUS_COLOR, STATUS_LABEL } from "../domain/status";
import type { Game } from "../domain/types";
import type { RatingsEntry } from "../domain/ratings";
import { Cover } from "./Cover";

const TONE: Record<string, string> = { good: "text-aurora", mixed: "text-warn", bad: "text-bad" };

function Tile({ icon, label, value, tone = "" }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="glass rounded-2xl px-3.5 py-3">
      <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fog">{icon}{label}</dt>
      <dd className={`m-0 mt-1 font-display text-[22px] font-bold leading-none tabular-nums ${tone || "text-mist"}`}>{value}</dd>
    </div>
  );
}

/** Cinematic header: blurred art backdrop, floating cover, title and the three numbers that matter. */
export function DrawerHero({ game, ratings, onClose }: { game: Game; ratings?: RatingsEntry; onClose: () => void }) {
  const [artFailed, setArtFailed] = useState(false);
  const platform = PLATFORM_BY_ID[game.platformId];
  const avg = ratings ? averageScore(ratings.scores) : undefined;
  const mine = userScore100(game.rating);
  const color = STATUS_COLOR[game.status];

  return (
    <header className="relative isolate overflow-hidden px-6 pb-5 pt-12">
      {game.coverUrl && !artFailed ? (
        <img
          src={game.coverUrl} alt="" aria-hidden decoding="async" onError={() => setArtFailed(true)}
          className="absolute inset-0 -z-20 size-full scale-150 object-cover opacity-60 blur-3xl saturate-150"
        />
      ) : (
        <div aria-hidden className="absolute inset-0 -z-20 opacity-60" style={{ background: `radial-gradient(90% 120% at 0 0, ${platform?.color ?? "#555"}, transparent 70%)` }} />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-ink-900/10 via-ink-900/60 to-ink-900" />

      <button type="button" onClick={onClose} aria-label="Fechar" className="icon-btn absolute right-4 top-4 z-10 !rounded-full backdrop-blur"><X size={18} /></button>

      <div className="flex items-end gap-5">
        <div className="w-[128px] shrink-0 -rotate-2 shadow-lift transition-transform duration-500 ease-expo hover:rotate-0 hover:scale-105"><Cover game={game} /></div>
        <div className="grid min-w-0 gap-2.5 pb-1">
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ color, borderColor: `${color}66`, background: `${color}1f` }}
          >
            <i className="size-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
            {STATUS_LABEL[game.status]}
          </span>
          <h2 id="game-drawer-title" className="font-display text-[28px] font-bold leading-[1.05] tracking-tight text-mist [text-wrap:balance]">{game.title}</h2>
          <p className="text-[13px] text-fog">
            {[game.year || null, game.genres.join(" · ") || null].filter(Boolean).join(" · ") || "Sem metadados"}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="tag" style={{ borderColor: platform?.color, color: platform?.color }} title={platform?.name}>{platform?.short ?? game.platformId}</span>
            <span className="tag"><i className="dot" style={{ background: PROVIDER_BY_ID[game.providerId]?.color }} />{PROVIDER_BY_ID[game.providerId]?.name ?? game.providerId}</span>
            {game.installed && <span className="tag ok">instalado</span>}
          </div>
        </div>
      </div>

      <dl className="m-0 mt-5 grid grid-cols-3 gap-2.5">
        <Tile icon={<Clock size={12} aria-hidden />} label="Horas" value={game.playtimeH.toLocaleString("pt-BR")} />
        <Tile icon={<Star size={12} aria-hidden />} label="Minha nota" value={mine !== undefined ? String(mine) : "—"} tone={mine !== undefined ? "text-warn" : "text-fog"} />
        <Tile icon={<TrendingUp size={12} aria-hidden />} label="Média pública" value={avg !== undefined ? String(avg) : "—"} tone={avg !== undefined ? TONE[scoreTone(avg)] : "text-fog"} />
      </dl>
      <p className="m-0 mt-3 flex items-center gap-1.5 text-xs text-fog">
        <HardDrive size={12} aria-hidden /> {platform?.name}{game.sizeGb ? ` · ${game.sizeGb} GB` : ""}
      </p>
    </header>
  );
}
