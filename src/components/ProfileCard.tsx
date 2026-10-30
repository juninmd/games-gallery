import { useMemo } from "react";
import { computeProfile } from "../domain/profile";
import type { Stats } from "../domain/stats";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import { useUi } from "../state/ui";

const R = 24;
const C = 2 * Math.PI * R;

/** Level avatar: gradient ring that fills with progress to the next level. */
export function LevelRing({ level, progress, size = 56 }: { level: number; progress: number; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Nível ${level}, ${Math.round(progress * 100)}% para o próximo`}>
      <svg viewBox="0 0 56 56" className="size-full -rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff8a4c" /><stop offset=".55" stopColor="#ff4d8d" /><stop offset="1" stopColor="#a56bff" />
          </linearGradient>
        </defs>
        <circle cx="28" cy="28" r={R} fill="none" stroke="rgb(255 255 255 / 9%)" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={R} fill="none" stroke="url(#ring-grad)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0.02, Math.min(1, progress)))}
          className="transition-[stroke-dashoffset] duration-1000 ease-expo [filter:drop-shadow(0_0_6px_rgb(255_77_141/0.55))]"
        />
      </svg>
      <span className="absolute inset-[7px] grid place-items-center rounded-full bg-ink-800 font-display text-[17px] font-bold text-mist shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]">
        {level}
      </span>
    </div>
  );
}

export function ProfileCard({ stats, compact }: { stats: Stats; compact: boolean }) {
  const profile = useMemo(() => computeProfile(stats), [stats]);
  const go = useUi((s) => s.go);
  const total = STATUS_ORDER.reduce((n, s) => n + stats.byStatus[s], 0) || 1;

  if (compact) {
    return (
      <button type="button" onClick={() => go("stats")} title={`Nível ${profile.level} · ${profile.title}`} aria-label={`Nível ${profile.level}, ${profile.title}. Abrir estatísticas`} className="rounded-full transition-transform duration-300 ease-expo hover:scale-110">
        <LevelRing level={profile.level} progress={profile.progress} size={46} />
      </button>
    );
  }

  return (
    <section aria-label="Seu perfil" className="glass relative grid gap-3 overflow-hidden rounded-2xl p-3.5">
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-rose/20 blur-2xl" />
      <button type="button" onClick={() => go("stats")} className="relative flex items-center gap-3 text-left" title="Abrir estatísticas">
        <LevelRing level={profile.level} progress={profile.progress} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[15px] font-bold leading-tight text-mist">{profile.title}</div>
          <div className="text-[11.5px] text-fog">Nível {profile.level}</div>
          <div className="mt-1 text-[10.5px] tabular-nums text-fog/80">
            {(profile.xp - profile.levelStart).toLocaleString("pt-BR")} / {(profile.nextLevelAt - profile.levelStart).toLocaleString("pt-BR")} XP
          </div>
        </div>
      </button>
      <div className="relative">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]" role="img" aria-label={STATUS_ORDER.map((s) => `${STATUS_LABEL[s]}: ${stats.byStatus[s]}`).join(", ")}>
          {STATUS_ORDER.map((s) => (
            <span key={s} className="h-full transition-[width] duration-700 ease-expo" style={{ width: `${(stats.byStatus[s] / total) * 100}%`, background: STATUS_COLOR[s] }} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10.5px] text-fog">
          <span><b className="font-semibold tabular-nums text-mist">{Math.round(stats.completionRate * 100)}%</b> zerados</span>
          <span><b className="font-semibold tabular-nums text-mist">{stats.installedGb.toLocaleString("pt-BR")}</b> GB em disco</span>
        </div>
      </div>
    </section>
  );
}
