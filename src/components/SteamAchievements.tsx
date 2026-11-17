import { useEffect, useState } from "react";
import { parseAchievements, type AchievementSummary } from "../domain/achievements";
import type { Game } from "../domain/types";
import { httpGetJson } from "../platform/http";
import { achievementsUrl, isValidSteamId, isValidSteamKey } from "../platform/steamApi";
import { useSecrets } from "../state/secrets";

type Result = { state: "loading" } | { state: "done"; data: AchievementSummary | null } | { state: "error" };

/** In-memory per app session cache, so reopening the drawer does not refetch. */
const cache = new Map<string, AchievementSummary | null>();
const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

export const canShowAchievements = (game: Game, steamId: string, steamKey: string) =>
  game.providerId === "steam" && /^\d{1,10}$/.test(game.storeId ?? "") && isValidSteamId(steamId) && isValidSteamKey(steamKey);

/** Steam achievements for a Steam game, using the Web API key from Conexões. */
export function SteamAchievements({ game }: { game: Game }) {
  const steamId = useSecrets((s) => s.steamId);
  const steamKey = useSecrets((s) => s.steamKey);
  const appId = game.storeId ?? "";
  const [result, setResult] = useState<Result>(() => (cache.has(appId) ? { state: "done", data: cache.get(appId)! } : { state: "loading" }));

  useEffect(() => {
    if (cache.has(appId)) return setResult({ state: "done", data: cache.get(appId)! });
    let alive = true;
    setResult({ state: "loading" });
    httpGetJson(achievementsUrl(appId, steamId, steamKey))
      .then((json) => { const data = parseAchievements(json); cache.set(appId, data); if (alive) setResult({ state: "done", data }); })
      .catch(() => alive && setResult({ state: "error" }));
    return () => { alive = false; };
  }, [appId, steamId, steamKey]);

  if (result.state === "loading") return <p className="muted small" aria-live="polite">Carregando conquistas…</p>;
  if (result.state === "error") return <p className="muted small">Não foi possível ler as conquistas. Na Steam, deixe “Detalhes dos jogos” como público.</p>;
  if (!result.data) return <p className="muted small">Este jogo não tem conquistas na Steam.</p>;
  const { total, unlocked, recent } = result.data;
  const pct = Math.round((unlocked / total) * 100);
  return (
    <div className="grid gap-2">
      <p className="m-0 text-sm text-mist"><strong className="tabular-nums">{unlocked}/{total}</strong> desbloqueadas ({pct}%)</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Conquistas desbloqueadas">
        <div className="h-full rounded-full bg-aurora" style={{ width: `${pct}%` }} />
      </div>
      {recent.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0">
          {recent.map((a) => (
            <li key={a.unlockedAt + a.name} className="flex justify-between gap-3 text-sm">
              <span className="text-fog" title={a.description}>{a.name}</span>
              <time className="muted small shrink-0" dateTime={a.unlockedAt}>{dateFmt.format(new Date(a.unlockedAt))}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
