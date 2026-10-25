import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { averageScore, scoreTone, steamAppIdOf, userScore100 } from "../domain/ratings";
import type { Game } from "../domain/types";
import { ratingEntry, ratingIsLoading, useRatings, useSecrets } from "../state/ratings";
import { useUi } from "../state/ui";

function Row({ label, score, count, detail, mine = false }: { label: string; score: number; count?: number; detail?: string; mine?: boolean }) {
  return (
    <li className={`score-row ${mine ? "mine" : scoreTone(score)}`}>
      <span className="score-label">{label}</span>
      <div className="score-bar" role="img" aria-label={`${label}: ${score} de 100`}><div style={{ width: `${score}%` }} /></div>
      <b>{score}</b>
      <small>{[detail, count ? `${count.toLocaleString("pt-BR")} avaliações` : null].filter(Boolean).join(" · ")}</small>
    </li>
  );
}

export function RatingsPanel({ game }: { game: Game }) {
  const entry = useRatings((s) => ratingEntry(s.entries, game.id));
  const loading = useRatings((s) => ratingIsLoading(s.loading, game.id));
  const error = useRatings((s) => s.errors[game.id]);
  const refresh = useRatings((s) => s.refresh);
  const rawgKey = useSecrets((s) => s.rawgKey);
  const go = useUi((s) => s.go);

  useEffect(() => {
    void refresh(game);
    // Refetch only when the game or the key changes; patches to other fields hit the cache anyway.
  }, [game.id, rawgKey]);

  const mine = userScore100(game.rating);
  const scores = entry?.scores ?? [];
  const avg = averageScore(scores);
  const hasSource = !!steamAppIdOf(game) || !!rawgKey;
  const diff = mine !== undefined && avg !== undefined ? mine - avg : undefined;

  return (
    <section className="panel">
      <div className="row">
        <h3>Notas</h3>
        <button className="btn ghost" disabled={loading || !hasSource} onClick={() => void refresh(game, true)}>
          <RefreshCw size={14} className={loading ? "spin" : ""} aria-hidden /> Atualizar
        </button>
      </div>
      <ul className="scores">
        {mine !== undefined ? <Row label="Minha nota" score={mine} mine /> : <li className="muted small">Você ainda não avaliou: use as estrelas acima.</li>}
        {scores.map((s) => <Row key={s.source} label={s.label} score={s.score} count={s.count} detail={s.detail ?? (s.matchedTitle && s.matchedTitle !== game.title ? `encontrado: ${s.matchedTitle}` : undefined)} />)}
      </ul>
      {diff !== undefined && (
        <p className="note">
          {Math.abs(diff) < 5 ? "Sua nota está alinhada com a média pública" : diff > 0 ? `Você gostou ${diff} pontos mais que a média pública` : `Você gostou ${-diff} pontos menos que a média pública`} ({avg}).
        </p>
      )}
      {!hasSource && (
        <p className="note warn">
          Sem fonte de nota para este jogo (não há versão na Steam).{" "}
          <button className="link" onClick={() => go("settings")}>Configurar chave RAWG</button> para ver Metacritic e comunidade.
        </p>
      )}
      {hasSource && entry && scores.length === 0 && entry.errors.length === 0 && !loading && <p className="note">Nenhuma fonte retornou nota para este jogo.</p>}
      {entry?.errors.map((e) => <p key={e} className="note warn">{e}</p>)}
      {error && <p className="note warn" role="alert">{error}</p>}
      {entry && <p className="muted small">Atualizado em {new Date(entry.fetchedAt).toLocaleString("pt-BR")}</p>}
    </section>
  );
}
